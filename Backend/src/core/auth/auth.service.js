import crypto from "crypto";
import ms from "ms";
import { FoodUser } from "../users/user.model.js";
import { FoodAdmin } from "../admin/admin.model.js";
import { AdminResetOtp } from "../admin/adminResetOtp.model.js";
import { FoodOrder } from "../../modules/food/orders/models/order.model.js";
import { FoodReferralSettings } from "../../modules/food/admin/models/referralSettings.model.js";
import { FoodReferralLog } from "../../modules/food/admin/models/referralLog.model.js";
import { createOrUpdateOtp, verifyOtp } from "../otp/otp.service.js";
import { signAccessToken, signRefreshToken } from "./token.util.js";
import { FoodRefreshToken } from "../refreshTokens/refreshToken.model.js";
import { ValidationError, AuthError } from "./errors.js";
import { config } from "../../config/env.js";
import { logger } from "../../utils/logger.js";
import { sendAdminResetOtpEmail } from "../../utils/email.js";
import mongoose from "mongoose";
import { ensureUserReferralCode, processNewUserReferral } from "../../modules/food/user/services/userReferral.service.js";
import { getRestaurantSubscriptionSettings } from "../../modules/food/admin/services/admin.service.js";
import { FEATURE_KEYS, isFeatureEnabled } from "../../modules/food/admin/services/featureSettings.service.js";
import { ADMIN_FULL_PERMISSIONS, sanitizeAdminPermissions } from '../../constants/permissions.js';
import { isMobilePlatform } from "../../utils/platform.js";

const ROLES = {
  USER: "USER",
  ADMIN: "ADMIN",
};

export const requestUserOtp = async (phone) => {
  if (!phone) {
    throw new ValidationError("Phone is required");
  }

  const otp = await createOrUpdateOtp(phone);
  // TODO: integrate SMS provider here
  const shouldExposeOtp =
    config.nodeEnv !== "production" || config.useDefaultOtp;
  return shouldExposeOtp ? { otp } : {};
};

export const verifyUserOtpAndLogin = async (
  phone,
  otp,
  referralCode,
  fcmToken,
  platform,
  name,
) => {
  console.log(
    `[FCM-LOGIN] User login platform received: rawPlatform=${String(platform ?? "") || "<empty>"}, hasToken=${Boolean(fcmToken)}`,
  );
  const result = await verifyOtp(phone, otp);

  if (!result.valid) {
    throw new AuthError(result.reason || "OTP verification failed");
  }

  let userDoc = await FoodUser.findOne({ phone });
  
  // Ensure user exists and mark as verified on successful OTP.
  // Check if user is new or hasn't provided a name yet
  const needsNamePrompt = !userDoc || !userDoc.name || String(userDoc.name).trim() === "" || String(userDoc.name).toLowerCase() === "null";
  const isNewUser = !userDoc;
  const trimmedName = typeof name === "string" ? name.trim() : "";

  if (!userDoc) {
    userDoc = await FoodUser.create({
      phone,
      isVerified: true,
      ...(trimmedName ? { name: trimmedName } : {}),
    });
  } else {
    let needsSave = false;
    if (!userDoc.isVerified) {
      userDoc.isVerified = true;
      needsSave = true;
    }
    if (trimmedName && !userDoc.name) {
      userDoc.name = trimmedName;
      needsSave = true;
    }
    if (needsSave) await userDoc.save();
  }

  // Block login for deactivated users
  if (userDoc.isActive === false) {
    throw new AuthError(
      "Your account has been deactivated. Please contact support.",
    );
  }

  // Update FCM token if provided
  if (fcmToken) {
    let isModified = false;
    if (isMobilePlatform(platform)) {
      if (!userDoc.fcmTokenMobile) userDoc.fcmTokenMobile = [];
      if (!userDoc.fcmTokenMobile.includes(fcmToken)) {
        userDoc.fcmTokenMobile.push(fcmToken);
        isModified = true;
      }
    } else {
      // Default to web if not explicitly mobile
      if (!userDoc.fcmTokens) userDoc.fcmTokens = [];
      if (!userDoc.fcmTokens.includes(fcmToken)) {
        userDoc.fcmTokens.push(fcmToken);
        isModified = true;
      }
    }
    if (isModified) {
      await userDoc.save();
    }
  }

  // Ensure unique, clean public alphanumeric referralCode exists (never ObjectId).
  await ensureUserReferralCode(userDoc);

  // Referral crediting: strictly for genuinely brand new accounts with provided referralCode.
  const codeRaw = typeof referralCode === "string" ? String(referralCode).trim().toUpperCase() : "";
  if (isNewUser && codeRaw) {
    try {
      await processNewUserReferral({
        newUserId: userDoc._id,
        referralCode: codeRaw,
      });
    } catch (e) {
      // Never fail login due to referral errors.
      logger?.warn?.({ err: e }, "Referral processing failed (user)");
    }
  }

  const user = userDoc.toObject();
  const payload = { userId: user._id.toString(), role: user.role || "USER" };

  const accessToken = signAccessToken(payload);
  const refreshToken = signRefreshToken(payload);

  const ttlMs = ms(config.jwtRefreshExpiresIn || "90d");
  const expiresAt = new Date(Date.now() + ttlMs);

  await FoodRefreshToken.create({
    userId: user._id,
    token: refreshToken,
    expiresAt,
  });

  return { accessToken, refreshToken, user, isNewUser };
};

export const adminLogin = async (email, password) => {
  if (!email || !password) {
    throw new ValidationError("Email and password are required");
  }

  const admin = await FoodAdmin.findOne({ email });
  if (!admin) {
    throw new AuthError("Invalid credentials");
  }

  if (admin.isDeleted || admin.isActive === false) {
    throw new AuthError("Admin account is inactive");
  }

  const isMatch = await admin.comparePassword(password);
  if (!isMatch) {
    throw new AuthError("Invalid credentials");
  }

  const effectivePermissions = admin.adminType === "super_admin"
    ? ADMIN_FULL_PERMISSIONS
    : sanitizeAdminPermissions(admin.permissions || {});

  const payload = {
    userId: admin._id.toString(),
    role: admin.role,
    adminType: admin.adminType || "super_admin",
  };

  const accessToken = signAccessToken(payload);
  const refreshToken = signRefreshToken(payload);

  const ttlMs = ms(config.jwtRefreshExpiresIn || "90d");
  const expiresAt = new Date(Date.now() + ttlMs);

  await FoodRefreshToken.create({
    userId: admin._id,
    token: refreshToken,
    expiresAt,
  });

  const userObj = admin.toObject();
  delete userObj.password;
  userObj.effectivePermissions = effectivePermissions;
  return { accessToken, refreshToken, user: userObj };
};



export const logout = async (refreshToken, fcmToken, platform) => {
  if (!refreshToken) {
    throw new ValidationError("Refresh token is required");
  }

  // 1. Remove specific FCM token from ALL collections if provided
  if (fcmToken) {
    console.log(`[FCM-Logout] Starting logout-driven token removal: platform=${platform}, tokenPreview=${fcmToken?.slice(0, 10)}...`);
    
    // We try to remove the token from all 4 possible models regardless of the user ID, 
    // ensuring no stale connections are left across any role or app the user was logged into.
    const field = isMobilePlatform(platform) ? "fcmTokenMobile" : "fcmTokens";
    const models = [FoodUser, FoodAdmin];
    
    try {
      await Promise.all(
        models.map((model) =>
          model.updateMany(
            { [field]: fcmToken },
            { $pull: { [field]: fcmToken } },
          ),
        ),
      );
      console.log("[FCM-Logout] Token removed from all collections successfully");
    } catch (err) {
      logger.warn({ err }, "Failed to remove FCM token from all collections during logout");
    }
  }

  // 2. Invalidate the refresh token (standard logout procedure)
  const deleted = await FoodRefreshToken.deleteOne({ token: refreshToken });
  return { invalidated: deleted.deletedCount > 0 };
};

export const getProfile = async (userId, role) => {
  if (!userId || !role) {
    throw new AuthError("Invalid token payload");
  }
  let profile = null;
  const id = userId;

  switch (role) {
    case ROLES.USER:
      profile = await FoodUser.findById(id).lean();
      break;
    case ROLES.ADMIN:
      profile = await FoodAdmin.findById(id).select("-password").lean();
      if (profile) {
        profile.effectivePermissions = profile.adminType === "super_admin"
          ? ADMIN_FULL_PERMISSIONS
          : sanitizeAdminPermissions(profile.permissions || {});
      }
      break;

    default:
      throw new AuthError("Unknown role");
  }

  if (!profile) {
    throw new AuthError("Profile not found");
  }
  return { user: profile };
};

const ADMIN_SERVICES_ALLOWED = ["food", "quickCommerce", "taxi"];

/** Update admin profile (name, email, phone, profileImage). Only for ADMIN role. */
export const updateAdminProfile = async (userId, body) => {
  if (!userId) {
    throw new AuthError("Invalid token payload");
  }
  const admin = await FoodAdmin.findById(userId);
  if (!admin) {
    throw new AuthError("Profile not found");
  }
  if (body.name !== undefined) admin.name = String(body.name || "").trim();
  if (body.email !== undefined) {
    const normalizedEmail = String(body.email || "")
      .trim()
      .toLowerCase();
    if (!normalizedEmail) {
      throw new ValidationError("Email is required");
    }

    const emailRegex = /^[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9\-]+(?:\.[a-zA-Z0-9\-]+)*\.[a-zA-Z]{2,10}$/;
    if (!emailRegex.test(normalizedEmail) || normalizedEmail.includes("..")) {
      throw new ValidationError("Invalid email format");
    }

    const domain = normalizedEmail.split("@")[1];
    const segments = domain ? domain.split(".") : [];
    if (segments.length >= 2 && segments[segments.length - 1] === segments[segments.length - 2]) {
      throw new ValidationError("Invalid email domain (repeated segments)");
    }

    if (normalizedEmail !== admin.email) {
      const duplicateAdmin = await FoodAdmin.findOne({
        _id: { $ne: admin._id },
        email: normalizedEmail,
      })
        .select("_id")
        .lean();
      if (duplicateAdmin) {
        throw new ValidationError("Email is already in use");
      }
    }
    admin.email = normalizedEmail;
  }
  if (body.phone !== undefined) admin.phone = String(body.phone || "").trim();
  if (body.profileImage !== undefined)
    admin.profileImage = String(body.profileImage || "").trim();
  if (body.address !== undefined) admin.address = body.address ? String(body.address).trim() : '';
  if (body.city !== undefined) admin.city = body.city ? String(body.city).trim() : '';
  if (body.state !== undefined) admin.state = body.state ? String(body.state).trim() : '';
  if (body.pincode !== undefined) admin.pincode = body.pincode ? String(body.pincode).trim() : '';
  if (body.latitude !== undefined) admin.latitude = body.latitude !== null ? Number(body.latitude) : null;
  if (body.longitude !== undefined) admin.longitude = body.longitude !== null ? Number(body.longitude) : null;
  // Normalize servicesAccess so legacy values (e.g. 'zomato') don't fail schema validation on save
  if (Array.isArray(admin.servicesAccess)) {
    const valid = admin.servicesAccess.filter((s) =>
      ADMIN_SERVICES_ALLOWED.includes(s),
    );
    admin.servicesAccess = valid.length ? valid : ["food"];
  } else {
    admin.servicesAccess = ["food"];
  }
  await admin.save();
  const profile = admin.toObject();
  delete profile.password;
  return { user: profile };
};

/** Change admin password. Only for ADMIN role. */
export const changeAdminPassword = async (
  userId,
  currentPassword,
  newPassword,
) => {
  if (!userId) {
    throw new AuthError("Invalid token payload");
  }
  const admin = await FoodAdmin.findById(userId);
  if (!admin) {
    throw new AuthError("Profile not found");
  }
  const isMatch = await admin.comparePassword(currentPassword);
  if (!isMatch) {
    throw new AuthError("Current password is incorrect");
  }
  if (!newPassword || String(newPassword).length < 6) {
    throw new ValidationError("New password must be at least 6 characters");
  }
  admin.password = newPassword;
  await admin.save();

  try {
    const { notifyAdminsSafely } = await import("../../core/notifications/firebase.service.js");
    void notifyAdminsSafely({
      title: "Security Alert: Password Changed 🔐",
      body: `The password for admin account ${admin.email} has been changed. If this was not you, please contact support immediately.`,
      data: {
        type: "security_alert",
        subType: "password_change",
        email: admin.email
      }
    });
  } catch (e) {
    console.error("Failed to notify admins of password change:", e);
  }

  return { success: true };
};

/** Admin forgot password: request OTP. Only accepts email that is registered as admin. */
export const requestAdminForgotPasswordOtp = async (email) => {
  const normalizedEmail = String(email || "")
    .trim()
    .toLowerCase();
  if (!normalizedEmail) {
    throw new ValidationError("Email is required");
  }

  const admin = await FoodAdmin.findOne({ email: normalizedEmail });
  if (!admin) {
    throw new AuthError("This email is not registered as an admin account.");
  }

  const otp = config.useDefaultOtp
    ? "123456"
    : String(crypto.randomInt(100000, 1000000));
  const ttlMs = (config.otpExpiryMinutes || 10) * 60 * 1000;
  const expiresAt = new Date(Date.now() + ttlMs);

  await AdminResetOtp.findOneAndUpdate(
    { email: normalizedEmail },
    { otp, expiresAt, attempts: 0 },
    { upsert: true, new: true },
  );

  if (config.useDefaultOtp) {
    logger.info(`Admin reset OTP for ${normalizedEmail}: ${otp}`);
  }

  const sent = await sendAdminResetOtpEmail(normalizedEmail, otp);
  if (!sent && !config.useDefaultOtp) {
    logger.warn(
      `Admin OTP not sent by email to ${normalizedEmail}; check SMTP config.`,
    );
  }

  return {
    success: true,
    message: "If this email is registered, you will receive an OTP shortly.",
  };
};

/** Admin forgot password: verify OTP and set new password in one call. */
export const resetAdminPasswordWithOtp = async (email, otp, newPassword) => {
  const normalizedEmail = String(email || "")
    .trim()
    .toLowerCase();
  const otpStr = String(otp || "").replace(/\D/g, "");
  if (!normalizedEmail || !otpStr) {
    throw new ValidationError("Email and OTP are required");
  }
  if (!newPassword || String(newPassword).length < 6) {
    throw new ValidationError("New password must be at least 6 characters");
  }

  const record = await AdminResetOtp.findOne({ email: normalizedEmail });
  if (!record) {
    throw new AuthError("OTP not found or expired. Please request a new code.");
  }
  if (record.expiresAt < new Date()) {
    await record.deleteOne();
    throw new AuthError("OTP has expired. Please request a new code.");
  }
  if (record.attempts >= (config.otpMaxAttempts || 5)) {
    throw new AuthError("Too many attempts. Please request a new code.");
  }
  record.attempts += 1;
  if (record.otp !== otpStr) {
    await record.save();
    throw new AuthError("Invalid OTP.");
  }

  const admin = await FoodAdmin.findOne({ email: normalizedEmail });
  if (!admin) {
    await record.deleteOne();
    throw new AuthError("Account not found.");
  }

  admin.password = newPassword;
  await admin.save();
  await record.deleteOne();

  try {
    const { notifyAdminsSafely } = await import("../../core/notifications/firebase.service.js");
    void notifyAdminsSafely({
      title: "Security Alert: Password Reset Successful 🔐",
      body: `The password for admin account ${admin.email} has been reset via OTP.`,
      data: {
        type: "security_alert",
        subType: "password_reset",
        email: admin.email
      }
    });
  } catch (e) {
    console.error("Failed to notify admins of password reset:", e);
  }

  return { success: true, message: "Password reset successfully." };
};

export const refreshAccessToken = async (token) => {
  if (!token) {
    throw new ValidationError("Refresh token is required");
  }

  const stored = await FoodRefreshToken.findOne({ token }).lean();
  if (!stored) {
    throw new AuthError("Invalid refresh token");
  }

  const jwt = await import("jsonwebtoken");
  let payload;
  try {
    payload = jwt.default.verify(token, config.jwtRefreshSecret);
  } catch {
    // Token is tampered or expired — delete the DB record too
    await FoodRefreshToken.deleteOne({ token }).catch(() => {});
    throw new AuthError("Invalid refresh token");
  }

  // If deactivated user, do not issue fresh access tokens (forces logout on client)
  if (payload?.role === "USER") {
    const u = await FoodUser.findById(payload.userId).select("isActive").lean();
    if (!u || u.isActive === false) {
      await FoodRefreshToken.deleteOne({ token }).catch(() => {});
      throw new AuthError("User account is deactivated");
    }
  }

  // Issue fresh tokens
  const newAccessToken = signAccessToken({
    userId: payload.userId,
    role: payload.role,
  });
  const newRefreshToken = signRefreshToken({
    userId: payload.userId,
    role: payload.role,
  });

  const ttlMs = ms(config.jwtRefreshExpiresIn || "90d");
  const expiresAt = new Date(Date.now() + ttlMs);

  // Store the new refresh token
  await FoodRefreshToken.create({
    userId: payload.userId,
    token: newRefreshToken,
    expiresAt,
  });

  // Gracefully delete the used refresh token after a 60-second grace period.
  // This prevents race conditions when concurrent requests or multiple tabs refresh simultaneously.
  setTimeout(async () => {
    try {
      await FoodRefreshToken.deleteOne({ token });
    } catch (_) {}
  }, 60000);

  return { accessToken: newAccessToken, refreshToken: newRefreshToken };
};

