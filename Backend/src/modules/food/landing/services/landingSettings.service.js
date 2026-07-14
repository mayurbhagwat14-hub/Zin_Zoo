import { FoodLandingSettings } from '../models/landingSettings.model.js';
import { uploadImageBufferDetailed, deleteLocalFile } from '../../../../services/localUpload.service.js';

export const getLandingSettings = async () => {
    let doc = await FoodLandingSettings.findOne().lean();
    if (!doc) {
        doc = (await FoodLandingSettings.create({})).toObject();
    }
    return doc;
};

export const updateLandingSettings = async (payload) => {
    const doc = await FoodLandingSettings.findOneAndUpdate({}, payload, {
        new: true,
        upsert: true
    }).lean();
    return doc;
};

export const uploadLandingVideoFile = async (file) => {
    if (!file) {
        throw new Error('No file provided');
    }

    const uploadResult = await uploadImageBufferDetailed(file.buffer, 'food/landing-videos');

    return {
        videoUrl: uploadResult.secure_url,
        publicId: uploadResult.public_id
    };
};

export const deleteLandingVideoFile = async (publicIdOrUrl) => {
    if (!publicIdOrUrl) return;
    try {
        await deleteLocalFile(publicIdOrUrl);
    } catch (error) {
        // ignore errors
    }
};

