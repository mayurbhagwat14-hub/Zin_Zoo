import React, { useState, useRef } from "react";
import ImageCropper from "./ImageCropper";
import { toast } from "sonner";
import { ImagePlus, X, UploadCloud } from "lucide-react";

export default function ImageUploadField({
  value,
  onChange,
  onClear,
  aspectRatio = 1,
  className = "",
  label = "Upload Image",
  helpText = "PNG, JPG, WEBP up to 10MB",
}) {
  const fileInputRef = useRef(null);
  const [selectedFileUrl, setSelectedFileUrl] = useState(null);
  const [isCropperOpen, setIsCropperOpen] = useState(false);

  const handleFileSelect = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file type
    if (!file.type.match(/^image\/(jpeg|png|webp)$/)) {
      toast.error("Invalid file type. Please upload a JPG, PNG, or WEBP.");
      e.target.value = "";
      return;
    }

    // Validate file size (10MB limit)
    if (file.size > 10 * 1024 * 1024) {
      toast.error("Image is too large. Please upload an image under 10MB.");
      e.target.value = "";
      return;
    }

    const objectUrl = URL.createObjectURL(file);
    setSelectedFileUrl(objectUrl);
    setIsCropperOpen(true);
    
    // Reset input so the same file can be selected again if canceled
    e.target.value = "";
  };

  const handleCropComplete = (croppedFile) => {
    if (selectedFileUrl) {
      URL.revokeObjectURL(selectedFileUrl);
    }
    setSelectedFileUrl(null);
    onChange(croppedFile);
  };

  const handleCropCancel = () => {
    if (selectedFileUrl) {
      URL.revokeObjectURL(selectedFileUrl);
    }
    setSelectedFileUrl(null);
    setIsCropperOpen(false);
  };

  return (
    <div className={`w-full ${className}`}>
      <div className="flex flex-col gap-1.5">
        <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">
          {label}
        </label>
        
        <div className="flex items-start gap-4">
          {/* Image Preview Area */}
          <div
            onClick={() => fileInputRef.current?.click()}
            className="relative w-32 h-32 shrink-0 rounded-xl border-2 border-dashed border-slate-300 dark:border-slate-700 hover:border-[#F84E04] dark:hover:border-[#F84E04] bg-slate-50 dark:bg-slate-800/50 overflow-hidden group cursor-pointer transition-colors shadow-sm"
            title="Click to select image"
          >
            {value ? (
              <>
                <img
                  src={typeof value === 'string' ? value : URL.createObjectURL(value)}
                  alt="Preview"
                  className="w-full h-full object-cover"
                />
                {/* Desktop hover overlay */}
                <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                  <span className="p-1.5 bg-white/25 hover:bg-white/40 text-white rounded-lg backdrop-blur-sm transition-colors" title="Change Image">
                    <ImagePlus className="w-4 h-4" />
                  </span>
                  {onClear && (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        onClear();
                      }}
                      className="p-1.5 bg-red-500/80 hover:bg-red-500 text-white rounded-lg backdrop-blur-sm transition-colors"
                      title="Remove Image"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  )}
                </div>
                {/* Mobile visible badge so user knows it's editable */}
                <div className="absolute bottom-1 right-1 bg-black/60 backdrop-blur-sm text-white rounded-md p-1 group-hover:hidden">
                  <ImagePlus className="w-3.5 h-3.5" />
                </div>
              </>
            ) : (
              <div className="w-full h-full flex flex-col items-center justify-center text-slate-400 group-hover:text-[#F84E04] group-hover:bg-[#F84E04]/5 transition-colors p-2 text-center">
                <UploadCloud className="w-8 h-8 mb-1.5 text-slate-400 group-hover:text-[#F84E04] transition-colors" />
                <span className="text-xs font-semibold text-slate-600 dark:text-slate-300">Click to upload</span>
                <span className="text-[10px] text-slate-400 mt-0.5">Browse file</span>
              </div>
            )}
          </div>

          <div className="flex-1 pt-1">
            <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-400 leading-relaxed">
              {helpText}
            </p>

            {/* Clickable Action Buttons in the empty space */}
            <div className="mt-3 flex items-center gap-2 flex-wrap">
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-[#F84E04] hover:bg-[#D94203] active:scale-95 text-white text-xs font-semibold transition-all shadow-sm cursor-pointer"
              >
                {value ? <ImagePlus className="w-3.5 h-3.5" /> : <UploadCloud className="w-3.5 h-3.5" />}
                <span>{value ? "Change Image" : "Add Image"}</span>
              </button>
              {value && onClear && (
                <button
                  type="button"
                  onClick={onClear}
                  className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-red-50 hover:bg-red-100 text-red-600 dark:bg-red-500/10 dark:hover:bg-red-500/20 dark:text-red-400 text-xs font-semibold transition-all border border-red-200 dark:border-red-500/30 cursor-pointer"
                >
                  <X className="w-3.5 h-3.5" />
                  <span>Remove</span>
                </button>
              )}
            </div>

            <input
              ref={fileInputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              onChange={handleFileSelect}
              className="hidden"
            />
            {value && typeof value !== 'string' && (
              <p className="mt-2 text-xs font-medium text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                Ready for upload ({(value.size / 1024).toFixed(1)} KB)
              </p>
            )}
          </div>
        </div>
      </div>

      {isCropperOpen && selectedFileUrl && (
        <ImageCropper
          open={isCropperOpen}
          onClose={handleCropCancel}
          imageSrc={selectedFileUrl}
          onCropCompleteAction={handleCropComplete}
          initialAspectRatio={aspectRatio}
        />
      )}
    </div>
  );
}
