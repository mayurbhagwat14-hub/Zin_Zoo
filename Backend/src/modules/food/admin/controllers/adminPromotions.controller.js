import Campaign from '../models/campaign.model.js';
import Cashback from '../models/cashback.model.js';
import Advertisement from '../models/advertisement.model.js';

// ========================
// CAMPAIGNS
// ========================

export const createCampaign = async (req, res) => {
  try {
    const campaign = new Campaign(req.body);
    await campaign.save();
    res.status(201).json({ success: true, data: campaign });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const getCampaigns = async (req, res) => {
  try {
    const campaigns = await Campaign.find().sort({ createdAt: -1 });
    res.status(200).json({ success: true, data: campaigns });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const updateCampaign = async (req, res) => {
  try {
    const campaign = await Campaign.findByIdAndUpdate(req.params.id, req.body, { new: true });
    if (!campaign) return res.status(404).json({ success: false, message: 'Campaign not found' });
    res.status(200).json({ success: true, data: campaign });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const deleteCampaign = async (req, res) => {
  try {
    const campaign = await Campaign.findByIdAndDelete(req.params.id);
    if (!campaign) return res.status(404).json({ success: false, message: 'Campaign not found' });
    res.status(200).json({ success: true, message: 'Campaign deleted' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const toggleCampaignStatus = async (req, res) => {
  try {
    const campaign = await Campaign.findById(req.params.id);
    if (!campaign) return res.status(404).json({ success: false, message: 'Campaign not found' });
    campaign.status = !campaign.status;
    await campaign.save();
    res.status(200).json({ success: true, data: campaign });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// ========================
// CASHBACKS
// ========================

export const createCashback = async (req, res) => {
  try {
    const cashback = new Cashback(req.body);
    await cashback.save();
    res.status(201).json({ success: true, data: cashback });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const getCashbacks = async (req, res) => {
  try {
    const cashbacks = await Cashback.find().sort({ createdAt: -1 });
    res.status(200).json({ success: true, data: cashbacks });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const updateCashback = async (req, res) => {
  try {
    const cashback = await Cashback.findByIdAndUpdate(req.params.id, req.body, { new: true });
    if (!cashback) return res.status(404).json({ success: false, message: 'Cashback not found' });
    res.status(200).json({ success: true, data: cashback });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const deleteCashback = async (req, res) => {
  try {
    const cashback = await Cashback.findByIdAndDelete(req.params.id);
    if (!cashback) return res.status(404).json({ success: false, message: 'Cashback not found' });
    res.status(200).json({ success: true, message: 'Cashback deleted' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const toggleCashbackStatus = async (req, res) => {
  try {
    const cashback = await Cashback.findById(req.params.id);
    if (!cashback) return res.status(404).json({ success: false, message: 'Cashback not found' });
    cashback.status = !cashback.status;
    await cashback.save();
    res.status(200).json({ success: true, data: cashback });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// ========================
// ADVERTISEMENTS
// ========================

export const createAdvertisement = async (req, res) => {
  try {
    const ad = new Advertisement(req.body);
    await ad.save();
    res.status(201).json({ success: true, data: ad });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const getAdvertisements = async (req, res) => {
  try {
    const ads = await Advertisement.find().sort({ createdAt: -1 });
    res.status(200).json({ success: true, data: ads });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const updateAdvertisement = async (req, res) => {
  try {
    const ad = await Advertisement.findByIdAndUpdate(req.params.id, req.body, { new: true });
    if (!ad) return res.status(404).json({ success: false, message: 'Advertisement not found' });
    res.status(200).json({ success: true, data: ad });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const deleteAdvertisement = async (req, res) => {
  try {
    const ad = await Advertisement.findByIdAndDelete(req.params.id);
    if (!ad) return res.status(404).json({ success: false, message: 'Advertisement not found' });
    res.status(200).json({ success: true, message: 'Advertisement deleted' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const updateAdvertisementStatus = async (req, res) => {
  try {
    const { status, isPaused } = req.body;
    const updateData = {};
    if (status !== undefined) updateData.status = status;
    if (isPaused !== undefined) updateData.isPaused = isPaused;

    const ad = await Advertisement.findByIdAndUpdate(req.params.id, updateData, { new: true });
    if (!ad) return res.status(404).json({ success: false, message: 'Advertisement not found' });
    res.status(200).json({ success: true, data: ad });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};
