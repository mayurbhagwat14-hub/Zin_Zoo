import { useState, useEffect, useRef } from "react"
import { useNavigate, useLocation } from "react-router-dom"
import { ArrowLeft, Loader2, AlertCircle, Smartphone, Shield, Lock } from "lucide-react"
import AnimatedPage from "@food/components/user/AnimatedPage"
import { Input } from "@food/components/ui/input"
import { Button } from "@food/components/ui/button"
import apiClient, { authAPI } from "@food/api"
import { setAuthData as setUserAuthData } from "@food/utils/auth"
import { motion, AnimatePresence } from "framer-motion"
import loginBanner from "@food/assets/loginbanner.png"

const FULL_NAME_REGEX = /^[A-Za-z ]+$/

export default function OTP() {
  const navigate = useNavigate()
  const location = useLocation()
  const searchParams = new URLSearchParams(location.search)
  const redirectTo = searchParams.get("redirect") || "/food/user"
  
  const [otp, setOtp] = useState(["", "", "", ""]) // exactly 4 digits
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState("")
  const [success, setSuccess] = useState(false)
  const [resendTimer, setResendTimer] = useState(0)
  const [authData, setAuthData] = useState(null)
  const [showNameInput, setShowNameInput] = useState(false)
  const [name, setName] = useState("")
  const [nameError, setNameError] = useState("")
  const [verifiedData, setVerifiedData] = useState(null)
  const [contactInfo, setContactInfo] = useState("")
  const [contactType, setContactType] = useState("phone")
  const [deviceToken, setDeviceToken] = useState(null)
  const [activePlatform, setActivePlatform] = useState("web")
  const inputRefs = useRef([])
  const submittingRef = useRef(false)

  useEffect(() => {
    // Redirect to home if already authenticated
    const isAuthenticated = localStorage.getItem("user_authenticated") === "true"
    if (isAuthenticated) {
      navigate("/food/user", { replace: true })
      return
    }

    // Get auth data from sessionStorage
    const stored = sessionStorage.getItem("userAuthData")
    if (!stored) {
      navigate("/food/user/auth/login", { replace: true })
      return
    }
    const data = JSON.parse(stored)
    setAuthData(data)

    if (data.method === "email" && data.email) {
      setContactType("email")
      setContactInfo(data.email)
    } else if (data.phone) {
      setContactType("phone")
      const phoneMatch = data.phone?.match(/(\+\d+)\s*(.+)/)
      if (phoneMatch) {
        setContactInfo(`${phoneMatch[1]}-${phoneMatch[2].replace(/\D/g, "")}`)
      } else {
        setContactInfo(data.phone || "")
      }
    }

    setResendTimer(60)
  }, [navigate])

  useEffect(() => {
    let timer;
    if (resendTimer > 0) {
      timer = setInterval(() => {
        if (typeof document !== "undefined" && document.hidden) return
        setResendTimer((prev) => prev - 1)
      }, 1000)
    }
    return () => {
      if (timer) clearInterval(timer)
    }
  }, [resendTimer > 0])

  useEffect(() => {
    if (inputRefs.current[0] && !showNameInput) {
      inputRefs.current[0].focus()
    }
  }, [showNameInput])

  // Auto OTP Verification
  useEffect(() => {
    if (authData && !showNameInput && !success && !error) {
      setOtp(["1", "2", "3", "4"])
      const timer = setTimeout(() => {
        if (!submittingRef.current) {
          handleVerify("1234")
        }
      }, 500)
      return () => clearTimeout(timer)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authData, showNameInput, success, error])

  const handleChange = (index, value) => {
    if (value && !/^\d$/.test(value)) return
    const newOtp = [...otp]
    newOtp[index] = value
    setOtp(newOtp)
    setError("")

    if (value && index < 3) {
      inputRefs.current[index + 1]?.focus()
    }

    if (!showNameInput && newOtp.slice(0, 4).every((digit) => digit !== "")) {
      handleVerify(newOtp.slice(0, 4).join(""))
    }
  }

  const handleKeyDown = (index, e) => {
    if (e.key === "Backspace") {
      if (otp[index]) {
        const newOtp = [...otp]
        newOtp[index] = ""
        setOtp(newOtp)
      } else if (index > 0) {
        inputRefs.current[index - 1]?.focus()
        const newOtp = [...otp]
        newOtp[index - 1] = ""
        setOtp(newOtp)
      }
    }
  }

  const handlePaste = (e) => {
    e.preventDefault()
    const pastedData = e.clipboardData.getData("text")
    const digits = pastedData.replace(/\D/g, "").slice(0, 4).split("")
    const newOtp = [...otp]
    digits.forEach((digit, i) => {
      if (i < 4) newOtp[i] = digit
    })
    setOtp(newOtp)
    if (!showNameInput && digits.length === 4) {
      handleVerify(newOtp.slice(0, 4).join(""))
    } else {
      inputRefs.current[Math.min(digits.length, 3)]?.focus()
    }
  }

  const handleVerify = async (otpValue = null) => {
    if (showNameInput) return
    if (submittingRef.current) return

    const code = (otpValue || otp.join("")).replace(/\D/g, "")
    const code4 = code.slice(0, 4)
    if (code4.length !== 4) {
      setError("OTP must be exactly 4 digits")
      return
    }

    submittingRef.current = true
    setIsLoading(true)
    setError("")

    try {
      const phone = authData?.method === "phone" ? authData.phone : null
      const email = authData?.method === "email" ? authData.email : null
      const purpose = authData?.isSignUp ? "register" : "login"
      const providedName = authData?.isSignUp ? authData?.name || null : null
      const referralCode = authData?.referralCode ? String(authData.referralCode).trim().toUpperCase() : null

      let fcmToken = null;
      let platform = "web";
      try {
        if (typeof window !== "undefined") {
          if (window.flutter_inappwebview) {
            platform = "mobile";
            const handlerNames = ["getFcmToken", "getFCMToken", "getPushToken", "getFirebaseToken"];
            for (const handlerName of handlerNames) {
              try {
                const t = await window.flutter_inappwebview.callHandler(handlerName, { module: "user" });
                if (t && typeof t === "string" && t.length > 20) {
                  fcmToken = t.trim();
                  break;
                }
              } catch (e) {}
            }
          } else {
            fcmToken = localStorage.getItem("fcm_web_registered_token_user") || null;
          }
        }
      } catch (e) {
        console.warn("Failed to get FCM token during login", e);
      }

      setDeviceToken(fcmToken);
      setActivePlatform(platform);

      const response = await authAPI.verifyOTP(
        phone, code4, purpose, providedName, email, "user", null, referralCode, fcmToken, platform
      )
      const data = response?.data?.data || response?.data || {}
      const accessToken = data.accessToken
      const refreshToken = data.refreshToken ?? null
      const user = data.user

      if (!accessToken || !user || !refreshToken) {
        throw new Error("Invalid response from server")
      }

      const hasName = user.name && String(user.name).trim().length > 0 && String(user.name).toLowerCase() !== "null";
      const needsName = data.isNewUser === true || !hasName;

      if (needsName) {
        setVerifiedData(data)
        setShowNameInput(true)
        setIsLoading(false)
        submittingRef.current = false
        return
      }

      sessionStorage.removeItem("userAuthData")
      setUserAuthData("user", accessToken, user, refreshToken)
      window.dispatchEvent(new Event("userAuthChanged"))
      setSuccess(true)
      setTimeout(() => navigate(redirectTo, { replace: true }), 600)
    } catch (err) {
      const status = err?.response?.status
      let message = err?.response?.data?.message || err?.response?.data?.error || err?.message || "Verification failed."
      if (status === 401) message = "Invalid or expired code."
      setError(message)
    } finally {
      setIsLoading(false)
      submittingRef.current = false
    }
  }

  const handleSubmitName = async () => {
    const normalizedName = String(name || "").replace(/\s+/g, " ").trim()
    if (!normalizedName || normalizedName.length < 2) {
      setNameError("Please enter a valid name")
      return
    }
    if (!FULL_NAME_REGEX.test(normalizedName)) {
      setNameError("Name can contain only letters and spaces")
      return
    }

    setIsLoading(true)
    setError("")
    setNameError("")

    try {
      const { accessToken, refreshToken, user } = verifiedData

      // Update name via profile API
      try {
        await apiClient.patch("/food/user/profile", 
          { name: normalizedName },
          { headers: { Authorization: `Bearer ${accessToken}` } }
        )
      } catch (e) {
        console.error("Failed to update name on backend, but proceeding with login", e)
      }

      sessionStorage.removeItem("userAuthData")
      setUserAuthData("user", accessToken, { ...user, name: normalizedName }, refreshToken)
      window.dispatchEvent(new Event("userAuthChanged"))
      setSuccess(true)
      setTimeout(() => navigate(redirectTo, { replace: true }), 600)
    } catch (err) {
      setError("Failed to complete registration. Please try again.")
    } finally {
      setIsLoading(false)
    }
  }

  const handleResend = async () => {
    if (resendTimer > 0 || isLoading) return
    setIsLoading(true)
    setError("")
    try {
      const phone = authData?.method === "phone" ? authData.phone : null
      const email = authData?.method === "email" ? authData.email : null
      const purpose = authData?.isSignUp ? "register" : "login"
      await authAPI.sendOTP(phone, purpose, email)
      setResendTimer(60)
    } catch (err) {
      setError("Failed to resend OTP.")
    } finally {
      setIsLoading(false)
    }
    setOtp(["", "", "", ""])
  }

  const formatTimer = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <AnimatedPage className="h-[100dvh] w-full bg-slate-50 sm:bg-gradient-to-br sm:from-[#FF5E00] sm:via-[#F05500] sm:to-[#CC4700] flex items-center justify-center sm:justify-end sm:pr-[8%] md:pr-[12%] lg:pr-[15%] font-sans overflow-hidden p-0 relative z-0">
      
      {/* --- DESKTOP PREMIUM SPLIT VIEW (LEFT SIDE) --- */}
      <div className="hidden sm:flex absolute left-0 top-0 w-[55%] h-full items-center justify-center p-12 overflow-hidden z-0">
        
        {/* Abstract Glows inside left side */}
        <div className="absolute top-0 left-0 w-full h-full overflow-hidden pointer-events-none">
          <div className="absolute -top-[20%] -left-[10%] w-[70%] h-[70%] rounded-full bg-white/20 blur-3xl opacity-60" />
          <div className="absolute bottom-[10%] -right-[10%] w-[60%] h-[80%] rounded-full bg-black/10 blur-3xl opacity-30" />
        </div>

        {/* Center Content of Left Side */}
        <div className="relative z-10 w-full max-w-lg flex flex-col items-center text-center">
          <motion.div animate={{ y: [-15, 10, -15] }} transition={{ duration: 5, repeat: Infinity, ease: "easeInOut" }}>
            <img src="/rider.png" alt="Delivery Rider" className="w-full max-w-[380px] drop-shadow-2xl mb-8 object-contain" />
          </motion.div>
          <h2 className="text-4xl lg:text-5xl font-black text-white tracking-tight mb-4 drop-shadow-md">
            ZÎN ZOO-<span className="text-[#FFE5D4] italic ml-1">X</span>
          </h2>
          <p className="text-white/90 text-lg lg:text-xl font-medium tracking-wide max-w-md">
            Fastest Food & Grocery Delivery at your doorstep. Fresh, safe, and on time!
          </p>
        </div>

        {/* Floating Animated Icons */}
        <motion.div className="absolute left-[15%] top-[20%]" animate={{ y: [0, -20, 0], rotate: [0, 15, -15, 0] }} transition={{ duration: 7, repeat: Infinity, ease: "easeInOut" }}>
          <svg className="w-12 h-12 text-white/30 drop-shadow-lg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M3 11c0-3.3 2.7-6 6-6h6c3.3 0 6 2.7 6 6v1H3v-1z"/><rect x="3" y="14" width="18" height="3" rx="1.5"/><path d="M3 12h18" strokeDasharray="1,1"/></svg>
        </motion.div>
        <motion.div className="absolute right-[20%] top-[30%]" animate={{ y: [0, 20, 0], rotate: [0, -20, 20, 0] }} transition={{ duration: 8, repeat: Infinity, ease: "easeInOut", delay: 1 }}>
          <svg className="w-14 h-14 text-white/30 drop-shadow-lg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M17 8H7l1 10a2 2 0 002 2h4a2 2 0 002-2l1-10z"/><line x1="6" y1="8" x2="18" y2="8"/><path d="M12 8V4"/></svg>
        </motion.div>
        <motion.div className="absolute left-[20%] bottom-[25%]" animate={{ y: [0, 15, 0], rotate: [0, 25, -25, 0] }} transition={{ duration: 6, repeat: Infinity, ease: "easeInOut", delay: 2 }}>
          <svg className="w-12 h-12 text-white/30 drop-shadow-lg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><circle cx="12" cy="12" r="8"/><circle cx="12" cy="12" r="3"/></svg>
        </motion.div>
        <motion.div className="absolute right-[25%] bottom-[15%]" animate={{ y: [0, -15, 0], rotate: [0, -15, 15, 0] }} transition={{ duration: 6.5, repeat: Infinity, ease: "easeInOut", delay: 0.5 }}>
          <svg className="w-12 h-12 text-white/30 drop-shadow-lg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M6 8V6a6 6 0 0112 0v2"/><rect x="3" y="8" width="18" height="12" rx="2"/></svg>
        </motion.div>
      </div>

      {/* Mobile Frame Container - strictly bounded height, no scrolling */}
      <main className="w-full max-w-[420px] h-[100dvh] sm:max-h-[800px] bg-white flex flex-col relative z-10 sm:rounded-[28px] sm:shadow-[0_30px_60px_rgba(0,0,0,0.15)] sm:border sm:border-white overflow-hidden">

        {/* Top Orange Curved Background */}
        <div className="absolute top-0 left-0 w-full h-[150px] sm:h-[180px] pointer-events-none z-0">
          <svg viewBox="0 0 1440 320" preserveAspectRatio="none" className="w-full h-full">
            <path fill="#FF5E00" fillOpacity="1" d="M0,96L80,106.7C160,117,320,139,480,128C640,117,800,75,960,64C1120,53,1280,75,1360,85.3L1440,96L1440,0L1360,0C1280,0,1120,0,960,0C800,0,640,0,480,0C320,0,160,0,80,0L0,0Z"></path>
          </svg>
        </div>

        {/* Floating Animated Food Icons */}
        <div className="absolute inset-0 pointer-events-none z-0 opacity-30 overflow-hidden">
          <motion.div className="absolute left-[10%] top-[25%]" animate={{ y: [0, -10, 0], rotate: [0, 5, -5, 0] }} transition={{ duration: 6, repeat: Infinity, ease: "easeInOut" }}>
            <svg className="w-6 h-6 text-[#FF5E00]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M3 11c0-3.3 2.7-6 6-6h6c3.3 0 6 2.7 6 6v1H3v-1z"/><rect x="3" y="14" width="18" height="3" rx="1.5"/><path d="M3 12h18" strokeDasharray="1,1"/></svg>
          </motion.div>
          <motion.div className="absolute left-[85%] top-[18%]" animate={{ y: [0, 8, 0], rotate: [0, -15, 15, 0] }} transition={{ duration: 5, repeat: Infinity, ease: "easeInOut", delay: 1 }}>
            <svg className="w-5 h-5 text-[#FF5E00]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><circle cx="12" cy="12" r="8"/><circle cx="12" cy="12" r="3"/></svg>
          </motion.div>
          <motion.div className="absolute left-[80%] top-[35%]" animate={{ y: [0, -8, 0], rotate: [0, 10, -10, 0] }} transition={{ duration: 5.5, repeat: Infinity, ease: "easeInOut", delay: 2 }}>
            <svg className="w-5 h-5 text-[#FF5E00]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M17 8H7l1 10a2 2 0 002 2h4a2 2 0 002-2l1-10z"/><line x1="6" y1="8" x2="18" y2="8"/><path d="M12 8V4"/></svg>
          </motion.div>
        </div>

        {/* Main Content Flow */}
        <div className="flex flex-col w-full h-full relative z-10 overflow-hidden pb-1">
          
          {/* Top Actions Row */}
          <div className="px-4 pt-3 pb-1 flex items-center justify-between shrink-0">
            <button onClick={() => navigate("/food/user/auth/login")} className="p-1.5 rounded-lg bg-transparent text-black transition-colors">
              <ArrowLeft className="h-5 w-5 stroke-[2.5]" />
            </button>
            <div className="flex flex-col items-center bg-white rounded-xl px-2 py-0.5 shadow-sm">
              <Shield className="h-3.5 w-3.5 text-[#FF5E00]" />
              <span className="text-[8px] font-bold text-gray-800 leading-tight">Secure</span>
              <span className="text-[8px] font-bold text-gray-800 leading-tight">Login</span>
            </div>
          </div>

          <div className="flex-grow max-h-[2vh] min-h-0 shrink" />

          {/* Shield & Logo Section (Compact) */}
          <div className="flex flex-col items-center shrink-0 px-4">
            <div className="mb-1 w-14 h-14 rounded-full bg-white/40 backdrop-blur-sm flex items-center justify-center shadow-lg p-1.5 border border-white/50">
              <div className="w-full h-full bg-[#FF5E00] rounded-full flex items-center justify-center shadow-inner">
                <Shield className="w-6 h-6 text-white fill-white" />
              </div>
            </div>
            
            <div className="flex items-center space-x-1 mb-0.5">
              <span className="text-[22px] font-extrabold tracking-tighter text-black">ZÎN ZOO-</span>
              <span className="text-[26px] font-black italic text-[#FF5E00]" style={{ transform: "skewX(-10deg)" }}>X</span>
            </div>
            <div className="flex items-center w-full max-w-[170px]">
              <div className="h-[1px] flex-grow bg-[#FF5E00]/80"></div>
              <span className="px-2 text-[7px] font-black tracking-[0.2em] text-gray-700 whitespace-nowrap uppercase">FOOD. GROCERY & MORE</span>
              <div className="h-[1px] flex-grow bg-[#FF5E00]/80"></div>
            </div>
          </div>

          <div className="flex-grow max-h-[2vh] min-h-0 shrink" />

          {/* Form Section */}
          <section className="px-4 w-full shrink-0" data-purpose="otp-form">
            <AnimatePresence mode="wait">
              {!showNameInput ? (
                <motion.div key="otp-view" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="w-full flex flex-col items-center">
                  <h1 className="text-lg sm:text-xl font-bold text-gray-800 text-center tracking-tight mb-0.5">Verify OTP</h1>
                  <p className="mt-1 mb-1 inline-flex items-center justify-center rounded-full bg-[#FF5E00]/10 px-4 py-1.5 text-[13px] sm:text-sm font-black text-[#FF5E00]">
                    OTP - 1234
                  </p>
                  <p className="text-gray-500 text-center text-[11px] sm:text-[12px] font-medium leading-tight">
                    We've sent a 4-digit OTP to<br/>
                    <span className="font-bold text-[#FF5E00] text-[12px] sm:text-[13px] tracking-wide">{contactInfo}</span>
                  </p>

                  <div className="w-full mt-2 space-y-2.5">
                    {/* OTP Inputs */}
                    <div className="flex justify-center gap-2">
                      {otp.map((digit, index) => (
                        <div key={index} className="relative">
                          <input
                            ref={(el) => (inputRefs.current[index] = el)}
                            type="text"
                            inputMode="numeric"
                            maxLength={1}
                            value={digit}
                            onChange={(e) => handleChange(index, e.target.value)}
                            onKeyDown={(e) => handleKeyDown(index, e)}
                            onPaste={index === 0 ? handlePaste : undefined}
                            disabled={isLoading}
                            className="w-[3rem] h-[3.5rem] sm:w-[3.25rem] sm:h-[3.75rem] text-center text-xl font-semibold bg-white border border-gray-200 focus:border-[#FF5E00] focus:ring-1 focus:ring-[#FF5E00] rounded-xl text-[#FF5E00] transition-all outline-none shadow-sm selection:bg-orange-100"
                          />
                        </div>
                      ))}
                    </div>

                    {error && (
                      <motion.div initial={{ opacity: 0, y: -5 }} animate={{ opacity: 1, y: 0 }} className="flex items-center justify-center gap-1 text-[10px] font-bold text-red-500">
                        <AlertCircle className="h-3 w-3 shrink-0" />
                        <span>{error}</span>
                      </motion.div>
                    )}

                    {/* Timer */}
                    <div className="text-center pt-1">
                      <p className="text-[11px] sm:text-[12px] font-semibold text-gray-500 flex items-center justify-center gap-1.5">
                        <svg className="w-3.5 h-3.5 text-[#FF5E00]" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2.5"><circle cx="12" cy="12" r="10" /><polyline points="12 6 12 16 14" /></svg>
                        OTP will expire in <span className="text-[#FF5E00] font-bold">{formatTimer(resendTimer)}</span>
                      </p>
                    </div>

                    {/* Verify Button */}
                    <button 
                      onClick={() => handleVerify()}
                      disabled={isLoading || otp.some(digit => digit === "")}
                      className="w-full py-2.5 sm:py-3 rounded-[10px] flex items-center justify-center space-x-2 transition-all bg-[#FF5E00] hover:bg-[#E05300] disabled:opacity-50 disabled:cursor-not-allowed shadow-[0_4px_14px_rgba(255,94,0,0.3)] active:scale-[0.98] text-white font-semibold text-[14px] sm:text-[15px]"
                    >
                      {isLoading ? (
                        <div className="flex items-center gap-2"><Loader2 className="h-4 w-4 animate-spin" /><span>Verifying...</span></div>
                      ) : (
                        <div className="flex items-center justify-between w-full px-4">
                          <span className="opacity-0 w-4"></span><span className="tracking-wide">Verify & Continue</span><ArrowLeft className="h-4 w-4 stroke-[2.5] rotate-180" />
                        </div>
                      )}
                    </button>

                    {/* Resend & Change Links */}
                    <div className="flex flex-col items-center space-y-2.5">
                      {resendTimer === 0 ? (
                        <p className="text-[11px] sm:text-[12px] font-medium text-gray-500">Didn't receive OTP? <button type="button" onClick={handleResend} disabled={isLoading} className="font-bold text-[#FF5E00] hover:underline">Resend OTP</button></p>
                      ) : (
                        <div className="h-[16px]"><p className="text-[11px] sm:text-[12px] font-medium text-gray-500">Didn't receive OTP? <span className="font-bold text-[#FF5E00]/50">Resend OTP</span></p></div>
                      )}
                      <button onClick={() => navigate("/food/user/auth/login")} className="flex items-center justify-center space-x-1.5 w-full py-2.5 bg-[#FFF2EA] hover:bg-[#FFE5D4] transition-colors rounded-[10px] text-[#FF5E00] font-bold text-[12px] sm:text-[13px]">
                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" /></svg>
                        <span>Change Mobile Number</span>
                      </button>
                    </div>
                  </div>
                </motion.div>
              ) : (
                <motion.div key="name-view" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} className="w-full flex flex-col items-center">
                  <h1 className="text-lg sm:text-xl font-bold text-gray-800 text-center tracking-tight mb-1">One Last Step</h1>
                  <p className="text-gray-500 text-center text-[11px] font-medium leading-relaxed">Tell us your name to complete your profile</p>
                  <div className="w-full mt-3 space-y-3">
                    <div className="w-full flex items-center border border-gray-200 rounded-xl bg-white px-3 py-2.5 focus-within:border-[#FF5E00] focus-within:ring-1 focus-within:ring-[#FF5E00] transition-all shadow-sm">
                      <input type="text" value={name} onChange={(e) => { const sanitized = e.target.value.replace(/[^A-Za-z ]/g, ""); setName(sanitized); if (nameError) setNameError(""); }} disabled={isLoading} placeholder="Enter your full name" className="flex-grow border-none focus:ring-0 p-0 text-gray-800 placeholder-gray-400 font-semibold text-sm outline-none tracking-wide bg-transparent" />
                    </div>
                    {nameError && <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-[10px] font-bold text-red-500 pl-2">{nameError}</motion.p>}
                    {error && <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-[10px] font-bold text-red-500 pl-2">{error}</motion.p>}
                    <button onClick={handleSubmitName} disabled={isLoading || name.trim().length < 2} className="w-full py-2.5 rounded-xl flex items-center justify-center space-x-2 transition-all bg-[#FF5E00] hover:bg-[#E05300] disabled:opacity-50 disabled:cursor-not-allowed shadow-[0_4px_14px_rgba(255,94,0,0.3)] active:scale-[0.98] text-white font-semibold text-[14px] mt-1 tracking-wide">
                      {isLoading ? <div className="flex items-center gap-2"><Loader2 className="h-4 w-4 animate-spin" /><span>Saving...</span></div> : <span>Complete Setup</span>}
                    </button>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </section>

          <div className="flex-grow min-h-0 shrink" />

          {/* Illustration Container */}
          <div className="w-full flex justify-center items-end shrink min-h-[40px] relative">
            <div className="absolute bottom-0 w-[120%] h-6 bg-gradient-to-t from-[#FFF2EA] to-transparent z-0 blur-sm rounded-[100%]" />
            <img alt="Delivery Rider" className="w-auto h-full max-h-[22vh] sm:max-h-[25vh] object-contain relative z-10" src="/rider.png" />
          </div>

          {/* Horizontal Features Section */}
          <div className="w-full flex justify-between items-start pt-1.5 pb-2 bg-[#FFF2EA]/30 border-t border-orange-100/40 shrink-0 mt-[-5px]">
            <div className="flex flex-col items-center flex-1 px-1">
              <div className="w-6 h-6 rounded-full bg-white flex items-center justify-center mb-0.5 shadow-sm border border-orange-50"><svg className="w-3 h-3 text-[#FF5E00]" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" /></svg></div>
              <p className="font-bold text-gray-800 text-[8.5px] leading-tight text-center">Fast Delivery</p>
              <p className="text-[7px] text-gray-400 leading-tight text-center mt-0.5">On time<br/>every time</p>
            </div>
            <div className="flex flex-col items-center flex-1 px-1">
              <div className="w-6 h-6 rounded-full bg-white flex items-center justify-center mb-0.5 shadow-sm border border-orange-50"><svg className="w-3 h-3 text-[#FF5E00]" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" /></svg></div>
              <p className="font-bold text-gray-800 text-[8.5px] leading-tight text-center">Safe & Secure</p>
              <p className="text-[7px] text-gray-400 leading-tight text-center mt-0.5">Your safety<br/>our priority</p>
            </div>
            <div className="flex flex-col items-center flex-1 px-1">
              <div className="w-6 h-6 rounded-full bg-white flex items-center justify-center mb-0.5 shadow-sm border border-orange-50"><svg className="w-3 h-3 text-[#FF5E00]" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" /></svg></div>
              <p className="font-bold text-gray-800 text-[8.5px] leading-tight text-center">Best Quality</p>
              <p className="text-[7px] text-gray-400 leading-tight text-center mt-0.5">Top quality<br/>products</p>
            </div>
            <div className="flex flex-col items-center flex-1 px-1">
              <div className="w-6 h-6 rounded-full bg-white flex items-center justify-center mb-0.5 shadow-sm border border-orange-50"><svg className="w-3 h-3 text-[#FF5E00]" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" /></svg></div>
              <p className="font-bold text-gray-800 text-[8.5px] leading-tight text-center">Top Support</p>
              <p className="text-[7px] text-gray-400 leading-tight text-center mt-0.5">We're here<br/>to help you</p>
            </div>
          </div>

          {/* Footer Text */}
          <div className="w-full flex justify-center pb-1.5 z-10 shrink-0">
            <div className="flex items-center space-x-1">
              <svg className="w-3 h-3 text-[#FF5E00]" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" /></svg>
              <span className="text-[9px] font-bold text-gray-600 tracking-wide">Your Trust, Our Priority</span>
            </div>
          </div>

        </div>
      </main>
    </AnimatedPage>
  )
}

