import React, { useState, useEffect } from 'react';
import { Search, Eye, Pencil, Trash2, Plus, Loader2, X, Clock } from 'lucide-react';
import { toast } from 'sonner';
import { servicesAdminAPI, adminAPI } from '@food/api';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@food/components/ui/dialog"

export default function ServicesList() {
  const [services, setServices] = useState([]);
  const [dbCategories, setDbCategories] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);
  
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [editId, setEditId] = useState(null);
  const [formData, setFormData] = useState({
    name: '',
    category: '',
    subCategory: '',
    basePrice: '',
    description: '',
    availableFrom: '09:00',
    availableTo: '18:00',
    provider: 'Admin'
  });

  useEffect(() => {
    fetchServices();
    fetchCategories();
  }, [searchQuery]);

  const fetchCategories = async () => {
    try {
      const response = await servicesAdminAPI.getCategories({});
      if (response?.data?.success) {
        setDbCategories(response.data.data.categories.filter(c => c.isActive));
      }
    } catch (error) {
      console.error('Failed to fetch categories for dropdown', error);
    }
  };

  const fetchServices = async () => {
    setLoading(true);
    try {
      const response = await servicesAdminAPI.getServices({ search: searchQuery });
      if (response?.data?.success) {
        setServices(response.data.data.services);
      }
    } catch (error) {
      toast.error('Failed to fetch services');
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const handleOpenModal = (service = null) => {
    if (service) {
      setEditId(service._id);
      setFormData({
        name: service.name,
        category: service.category,
        subCategory: service.subCategory || '',
        basePrice: service.basePrice,
        description: service.description || '',
        availableFrom: service.availableFrom,
        availableTo: service.availableTo,
        provider: service.provider
      });
    } else {
      setEditId(null);
      setFormData({
        name: '',
        category: '',
        subCategory: '',
        basePrice: '',
        description: '',
        availableFrom: '09:00',
        availableTo: '18:00',
        provider: 'Admin'
      });
    }
    setIsModalOpen(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      const payload = {
        ...formData,
        basePrice: Number(formData.basePrice),
        zoneId: null
      };

      if (editId) {
        await servicesAdminAPI.updateService(editId, payload);
        toast.success('Service updated successfully');
      } else {
        await servicesAdminAPI.addService(payload);
        toast.success('Service added successfully');
      }
      setIsModalOpen(false);
      fetchServices();
    } catch (error) {
      toast.error(error?.response?.data?.message || 'Something went wrong');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async (id, name) => {
    if (!window.confirm(`Are you sure you want to delete "${name}"?`)) return;
    try {
      await servicesAdminAPI.deleteService(id);
      toast.success('Service deleted successfully');
      fetchServices();
    } catch (error) {
      toast.error('Failed to delete service');
    }
  };

  const handleToggleStatus = async (service) => {
    try {
      await servicesAdminAPI.updateService(service._id, { isActive: !service.isActive });
      toast.success('Status updated successfully');
      fetchServices();
    } catch (error) {
      toast.error('Failed to update status');
    }
  };

  return (
    <div className="p-4 lg:p-6 bg-slate-50 dark:bg-[#0f172a] min-h-screen">
      <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-800 p-6 mb-6">
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-emerald-500 to-teal-600 flex items-center justify-center shadow-md shadow-emerald-500/10">
              <span className="text-white font-bold">SV</span>
            </div>
            <div>
              <h1 className="text-xl font-bold text-slate-800 dark:text-white leading-tight">Services List</h1>
              <p className="text-xs font-medium text-slate-500 dark:text-slate-400 mt-0.5">Manage all active services</p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <button 
              onClick={() => handleOpenModal()}
              className="px-4 py-2 text-xs font-semibold text-white bg-slate-900 rounded-lg hover:bg-slate-800 transition-colors flex items-center gap-1.5 shadow-sm"
            >
              <Plus className="w-4 h-4" /> Add Service
            </button>
            <div className="relative">
              <input
                type="text"
                placeholder="Search..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9 pr-4 py-2 w-48 lg:w-60 text-xs rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all"
              />
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            </div>
          </div>
        </div>
      </div>

      <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-800 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-slate-50 dark:bg-slate-800/50 border-b border-slate-200/60 dark:border-slate-800">
              <tr>
                <th className="px-6 py-4 text-left text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">SL</th>
                <th className="px-6 py-4 text-left text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Service</th>
                <th className="px-6 py-4 text-left text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Provider</th>
                <th className="px-6 py-4 text-left text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Category</th>
                <th className="px-6 py-4 text-left text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Time</th>
                <th className="px-6 py-4 text-left text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Hourly Rate</th>
                <th className="px-6 py-4 text-left text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Status</th>
                <th className="px-6 py-4 text-center text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800 bg-white dark:bg-slate-900">
              {loading ? (
                <tr>
                  <td colSpan={8} className="px-6 py-12 text-center">
                    <Loader2 className="w-6 h-6 animate-spin text-emerald-600 mx-auto" />
                    <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">Loading services...</p>
                  </td>
                </tr>
              ) : services.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-6 py-12 text-center">
                    <p className="text-sm font-semibold text-slate-600 dark:text-slate-400">No services found.</p>
                  </td>
                </tr>
              ) : (
                services.map((service, idx) => (
                  <tr key={service._id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30 transition-colors">
                    <td className="px-6 py-4 text-xs font-semibold text-slate-600 dark:text-slate-400">{idx + 1}</td>
                    <td className="px-6 py-4">
                      <span className="text-xs font-bold text-slate-800 dark:text-slate-200">{service.name}</span>
                    </td>
                    <td className="px-6 py-4 text-xs text-slate-800 dark:text-slate-200 font-bold">{service.provider}</td>
                    <td className="px-6 py-4 text-xs text-slate-600 dark:text-slate-400 font-medium">
                      <div>{service.category} {service.subCategory ? `(${service.subCategory})` : ''}</div>
                    </td>
                    <td className="px-6 py-4 text-xs text-slate-600 dark:text-slate-400 font-medium flex items-center gap-1.5">
                      <Clock className="w-3.5 h-3.5 text-slate-400" />
                      {service.availableFrom} - {service.availableTo}
                    </td>
                    <td className="px-6 py-4 text-xs font-bold text-slate-800 dark:text-slate-200">₹{service.basePrice}</td>
                    <td className="px-6 py-4">
                      <button 
                        onClick={() => handleToggleStatus(service)}
                        className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold transition-colors ${
                          service.isActive ? 'bg-emerald-50 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-100' : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200'
                        }`}
                      >
                        {service.isActive ? 'Active' : 'Inactive'}
                      </button>
                    </td>
                    <td className="px-6 py-4 text-center">
                      <div className="flex items-center justify-center gap-1.5">
                        <button onClick={() => handleOpenModal(service)} className="p-1 rounded hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-400">
                          <Pencil className="w-4 h-4" />
                        </button>
                        <button onClick={() => handleDelete(service._id, service.name)} className="p-1 rounded hover:bg-red-50 dark:hover:bg-red-950/30 text-red-500">
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
        <DialogContent className="max-w-md p-0 overflow-hidden bg-white dark:bg-slate-900 border dark:border-slate-800">
          <DialogHeader className="px-6 py-4 border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50 flex flex-row items-center justify-between">
            <DialogTitle className="text-lg font-bold text-slate-900 dark:text-white">
              {editId ? 'Edit Vendor Service' : 'Add Vendor Service'}
            </DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="p-6 space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-bold text-slate-800 dark:text-slate-200 mb-1">Category</label>
                <select
                  required
                  value={formData.category}
                  onChange={(e) => setFormData({ ...formData, category: e.target.value, subCategory: '' })}
                  className="w-full px-3 py-2 border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-white rounded-xl text-sm focus:outline-none focus:border-emerald-500"
                >
                  <option value="" className="bg-white dark:bg-slate-800 text-slate-800 dark:text-white">Select Category</option>
                  {dbCategories.map(cat => (
                    <option key={cat._id} value={cat.name} className="bg-white dark:bg-slate-800 text-slate-800 dark:text-white">{cat.name}</option>
                  ))}
                </select>
              </div>

              {formData.category && dbCategories.find(c => c.name === formData.category)?.subCategories?.length > 0 && (
                <div>
                  <label className="block text-sm font-bold text-slate-800 dark:text-slate-200 mb-1">Sub-Category</label>
                  <select
                    required
                    value={formData.subCategory}
                    onChange={(e) => setFormData({ ...formData, subCategory: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-white rounded-xl text-sm focus:outline-none focus:border-emerald-500"
                  >
                    <option value="" className="bg-white dark:bg-slate-800 text-slate-800 dark:text-white">Select Sub-Category</option>
                    {dbCategories.find(c => c.name === formData.category).subCategories.map((sub, idx) => (
                      <option key={idx} value={sub?.name || sub} className="bg-white dark:bg-slate-800 text-slate-800 dark:text-white">{sub?.name || sub}</option>
                    ))}
                  </select>
                </div>
              )}
            </div>
            
            
            <div>
              <label className="block text-sm font-bold text-slate-800 dark:text-slate-200 mb-1">Service Name</label>
              <input
                required
                type="text"
                placeholder="e.g. AC Repair Service"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                className="w-full px-3 py-2 border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white rounded-xl text-sm focus:outline-none focus:border-emerald-500"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-bold text-slate-800 dark:text-slate-200 mb-1">Available From</label>
                <input
                  required
                  type="time"
                  value={formData.availableFrom}
                  onChange={(e) => setFormData({ ...formData, availableFrom: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white rounded-xl text-sm focus:outline-none focus:border-emerald-500"
                />
              </div>
              <div>
                <label className="block text-sm font-bold text-slate-800 dark:text-slate-200 mb-1">Available To</label>
                <input
                  required
                  type="time"
                  value={formData.availableTo}
                  onChange={(e) => setFormData({ ...formData, availableTo: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white rounded-xl text-sm focus:outline-none focus:border-emerald-500"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-bold text-slate-800 dark:text-slate-200 mb-1">Base Price (₹)</label>
              <input
                required
                type="number"
                min="0"
                value={formData.basePrice}
                onChange={(e) => setFormData({ ...formData, basePrice: e.target.value })}
                className="w-full px-3 py-2 border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white rounded-xl text-sm focus:outline-none focus:border-emerald-500"
              />
            </div>

            <div>
              <label className="block text-sm font-bold text-slate-800 dark:text-slate-200 mb-1">Description (Optional)</label>
              <textarea
                rows="3"
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                className="w-full px-3 py-2 border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white rounded-xl text-sm focus:outline-none focus:border-emerald-500 resize-none"
              ></textarea>
            </div>

            <div className="pt-2">
              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full py-3 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl text-sm transition-colors flex justify-center items-center gap-2"
              >
                {isSubmitting && <Loader2 className="w-4 h-4 animate-spin" />}
                {isSubmitting ? 'Saving...' : 'Save Service'}
              </button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
