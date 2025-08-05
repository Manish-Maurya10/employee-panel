import React, { useState, useRef, useEffect } from "react";
import { FaUser, FaLink, FaFileUpload, FaCalendarAlt, FaTags, FaAlignLeft } from "react-icons/fa";
import { useUserInfo } from "../context/UserInfoContext";
import useStoreData from "../hooks/useStoreData";

export default function AddDocumentModal({ open, onClose, onAdd, onSuccess, companyId, initialData }) {
  console.log("🎭 [MODAL] AddDocumentModal rendering - open:", open, "companyId:", companyId);
  
  const { user, aid } = useUserInfo();
  const employeeId = aid || user?.employeeId || user?.id || 'temp-employee-id';
  
  console.log("👤 [MODAL] User context - user aid:", user?.aid, "employeeId:", employeeId);
  
  // Use the passed companyId prop instead of user context to avoid undefined errors
  const { uploadMedia, addLink, loading: uploadLoading, error: uploadError } = useStoreData(companyId, employeeId);
  
  console.log("📦 [MODAL] useStoreData hook - uploadLoading:", uploadLoading, "uploadError:", uploadError);
  
  const fileInputRef = useRef(null);
  const docInputRefs = useRef([]);
  
  const [form, setForm] = useState(initialData || {
    title: "",
    submitterName: user?.name || "",
    linkData: "",
    textData: "",
    category: "",
    tags: "",
    notes: "",
    createdAt: new Date().toISOString(),
    customFields: [],
  });
  
  const [uploadedFiles, setUploadedFiles] = useState([]);
  const [customFields, setCustomFields] = useState(initialData?.customFields || []);
  const [error, setError] = useState("");
  const [successMessage, setSuccessMessage] = useState("");
  const [uploadResults, setUploadResults] = useState({ successful: [], failed: [] });
  const [isUploading, setIsUploading] = useState(false);

  console.log("📁 [MODAL] File state - uploadedFiles count:", uploadedFiles.length, "isUploading:", isUploading);

  // Reset uploadedFiles only when modal closes
  useEffect(() => {
    console.log("🎭 [MODAL] Modal open state changed - open:", open);
    if (!open) {
      console.log("🎭 [MODAL] Modal closed, resetting uploadedFiles");
      setUploadedFiles([]);
    }
  }, [open]);

  if (!open) {
    console.log("🎭 [MODAL] Modal not open, returning null");
    return null;
  }

  const handleChange = (e) => {
    console.log("📝 [MODAL] Form field changed:", e.target.name, "value:", e.target.value);
    setForm({ ...form, [e.target.name]: e.target.value });
  };

  const handleFileUpload = (e) => {
    const files = Array.from(e.target.files);
    console.log("📁 [MODAL] File upload triggered - files selected:", files.length);
    console.log("📁 [MODAL] File names:", files.map(f => f.name));
    
    setUploadedFiles(prev => {
      const newFiles = [...prev, ...files];
      console.log("📁 [MODAL] Updated uploadedFiles - previous count:", prev.length, "new count:", newFiles.length);
      return newFiles;
    });
    
    e.target.value = ""; // Reset input so selecting the same file again works
    console.log("📁 [MODAL] File input reset");
  };

  const handleRemoveFile = (index) => {
    console.log("🗑️ [MODAL] Removing file at index:", index);
    setUploadedFiles(prev => {
      const newFiles = prev.filter((_, i) => i !== index);
      console.log("🗑️ [MODAL] Updated uploadedFiles after removal - previous count:", prev.length, "new count:", newFiles.length);
      return newFiles;
    });
  };

  const handleCustomFieldChange = (idx, key, value) => {
    console.log("📝 [MODAL] Custom field changed - idx:", idx, "key:", key, "value:", value);
    const updated = [...customFields];
    updated[idx][key] = value;
    setCustomFields(updated);
  };

  const handleAddCustomField = () => {
    console.log("➕ [MODAL] Adding custom field");
    setCustomFields([...customFields, { question: "", answer: "" }]);
  };

  const handleRemoveCustomField = (idx) => {
    console.log("🗑️ [MODAL] Removing custom field at index:", idx);
    setCustomFields(customFields.filter((_, i) => i !== idx));
  };

  const handleSubmit = async (e) => {
    console.log("🚀 [MODAL] Form submission started");
    e.preventDefault();
    setError("");
    
    let hasFileUpload = false;
    let hasLinkUpload = false;
    let errorMessage = "";
    let uploadedFileMetas = [];
    let successfulFiles = [];
    let failedFiles = [];
    
    // If there are files, upload them
    if (uploadedFiles.length > 0) {
      console.log("📁 [MODAL] Starting file upload process - files count:", uploadedFiles.length);
      setIsUploading(true);
      setUploadResults({ successful: [], failed: [] });
      
      try {
        // Generate session group ID once for all files in this upload
        const sessionGroupId = crypto.randomUUID();
        console.log("🆔 [MODAL] Generated session group ID:", sessionGroupId);
        
        // Sort files by size (smallest first for better user experience)
        const sortedFiles = [...uploadedFiles].sort((a, b) => a.size - b.size);
        console.log("📁 [MODAL] Sorted files by size:", sortedFiles.map(f => ({ name: f.name, size: f.size })));
        
        // Upload files sequentially in sorted order
        for (let i = 0; i < sortedFiles.length; i++) {
          const file = sortedFiles[i];
          console.log("📤 [MODAL] Uploading file:", file.name, "size:", file.size);
          try {
            const meta = await uploadMedia(file, {
              title: form.title,
              submitterName: form.submitterName,
              linkData: form.linkData,
              textData: form.textData,
              category: form.category,
              tags: form.tags,
              notes: form.notes,
              createdAt: form.createdAt,
              customFields,
              sessionGroupId: sessionGroupId, // Same session group ID for all files
              // Removed companyId - redundant with document path
            });
            if (meta.success) {
              console.log("✅ [MODAL] File upload successful:", file.name);
              uploadedFileMetas.push(meta);
              successfulFiles.push({ file, meta });
            } else {
              console.log("❌ [MODAL] File upload failed:", file.name, "error:", meta.error);
              failedFiles.push({ file, error: meta.error || 'Upload failed' });
            }
          } catch (err) {
            console.error("❌ [MODAL] File upload error:", file.name, "error:", err.message);
            failedFiles.push({ file, error: err.message || 'Upload failed' });
          }
        }
        
        // Update upload results
        console.log("📊 [MODAL] Upload results - successful:", successfulFiles.length, "failed:", failedFiles.length);
        setUploadResults({ successful: successfulFiles, failed: failedFiles });
        
        // Remove successful files from selection
        if (successfulFiles.length > 0) {
          const successfulFileNames = successfulFiles.map(item => item.file.name);
          console.log("🗑️ [MODAL] Removing successful files from selection:", successfulFileNames);
          setUploadedFiles(prev => prev.filter(file => !successfulFileNames.includes(file.name)));
        }
        
        // Set success flag if any files were uploaded
        if (successfulFiles.length > 0) {
          hasFileUpload = true;
          console.log("✅ [MODAL] File upload completed successfully");
          // Call onAdd with uploaded file metadata
          const documentData = {
            ...form,
            customFields,
            files: uploadedFileMetas,
            id: Date.now(),
          };
          onAdd(documentData);
        }
        
      } catch (err) {
        console.error("❌ [MODAL] File upload process error:", err.message);
        errorMessage = err.message || 'File upload failed';
        setError(errorMessage);
      } finally {
        console.log("🏁 [MODAL] File upload process finished - setting isUploading to false");
        setIsUploading(false);
      }
    }
    
    // If there is a link, store it in Firestore (regardless of file upload)
    if (form.linkData) {
      console.log("🔗 [MODAL] Processing link data:", form.linkData);
      const linkData = {
        ...form,
        url: form.linkData, // Store as 'url' for compatibility
        createdAt: new Date().toISOString(),
      };
      delete linkData.linkData; // Remove the old property
      const result = await addLink(linkData);
      if (!result.success) {
        console.log("❌ [MODAL] Link addition failed:", result.error);
        errorMessage = result.error || "Failed to add link";
        setError(errorMessage);
      } else {
        console.log("✅ [MODAL] Link added successfully");
        hasLinkUpload = true;
      }
    }
    
    // Show message and redirect based on what was uploaded
    // Check final state after all processing is complete
    const hasRemainingFiles = failedFiles.length > 0; // Remaining files = failed files (successful ones are removed)
    const hasFailedFiles = failedFiles.length > 0;
    
    console.log("📊 [MODAL] Final upload state - hasFileUpload:", hasFileUpload, "hasLinkUpload:", hasLinkUpload, "hasRemainingFiles:", hasRemainingFiles, "hasFailedFiles:", hasFailedFiles);
    
    // Clear any existing error if all files were successful
    if (hasFileUpload && !hasRemainingFiles && !hasFailedFiles) {
      setError(""); // Clear any error state
    }
    
    if (hasFileUpload && hasLinkUpload && !hasRemainingFiles && !hasFailedFiles) {
      console.log("✅ [MODAL] Both file and link uploaded successfully");
      setSuccessMessage('File and link added successfully!');
      setTimeout(() => {
        if (typeof onSuccess === 'function') onSuccess('File and link added successfully!');
      }, 1500);
    } else if (hasFileUpload && !hasRemainingFiles && !hasFailedFiles) {
      console.log("✅ [MODAL] File uploaded successfully");
      setSuccessMessage('File added successfully!');
      setTimeout(() => {
        if (typeof onSuccess === 'function') onSuccess('File added successfully!');
      }, 1500);
    } else if (hasLinkUpload && !hasRemainingFiles && !hasFailedFiles) {
      console.log("✅ [MODAL] Link added successfully");
      setSuccessMessage('Link added successfully!');
      setTimeout(() => {
        if (typeof onSuccess === 'function') onSuccess('Link added successfully!');
      }, 1500);
    } else if (hasRemainingFiles || hasFailedFiles) {
      // Don't redirect - let user retry failed files
      if (hasFileUpload) {
        const failedFileNames = failedFiles.map(item => item.file.name).join(', ');
        const errorMsg = failedFileNames ? `Failed to upload: ${failedFileNames}` : 'Please retry failed files.';
        console.log("⚠️ [MODAL] Some files failed to upload:", errorMsg);
        setError(`Some files uploaded successfully. ${errorMsg}`);
      } else {
        console.log("❌ [MODAL] No files or links provided");
        setError(errorMessage || "Please upload a file or enter a link.");
      }
    } else if (!hasFileUpload && !hasLinkUpload) {
      // No files or links provided
      console.log("❌ [MODAL] No files or links provided");
      setError("Please upload a file or enter a link.");
    } else if (errorMessage) {
      if (typeof onSuccess === 'function') onSuccess(errorMessage);
    } else {
      if (typeof onSuccess === 'function') onSuccess("Please upload a file or enter a link.");
    }
    
    // Reset form if not editing
    if (!initialData) {
      console.log("🔄 [MODAL] Resetting form for new document");
      setForm({
        title: "",
        submitterName: user?.name || "",
        linkData: "",
        textData: "",
        category: "",
        tags: "",
        notes: "",
        createdAt: new Date().toISOString(),
        customFields: [],
      });
      setUploadedFiles([]);
      setCustomFields([]);
    }
    // Don't call onClose here - let onSuccess handle the redirection
  };

  console.log("🎭 [MODAL] Rendering modal content");

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-gradient-to-br from-white/80 to-purple-100/80 backdrop-blur-[6px]">
      {/* Success Notification */}
      {successMessage && (
        <div className="fixed top-8 left-1/2 -translate-x-1/2 z-[100] bg-gradient-to-r from-green-500 to-green-600 text-white px-6 py-3 rounded-xl shadow-xl font-semibold flex items-center gap-2 text-base animate-slideDown">
          <svg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 24 24' strokeWidth={2} stroke='currentColor' className='w-6 h-6 text-white'>
            <path strokeLinecap='round' strokeLinejoin='round' d='M5 13l4 4L19 7' />
          </svg>
          {successMessage}
        </div>
      )}
      <div className="bg-white/80 border border-purple-200 rounded-3xl shadow-2xl w-full max-w-4xl p-0 relative animate-modalIn backdrop-blur-xl ring-1 ring-purple-100">
        <div className="w-full h-full max-h-[90vh] flex flex-col">
          <button
            className="absolute top-3 right-3 text-gray-400 hover:text-purple-500 text-2xl transition-colors rounded-full p-1 focus:outline-none focus:ring-2 focus:ring-purple-300 bg-white/70 shadow-md hover:bg-purple-100"
            onClick={onClose}
            aria-label="Close"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              <circle cx="12" cy="12" r="11" stroke="currentColor" strokeWidth="2" fill="none" />
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
          
          <div className="px-8 pt-8 pb-2">
            <h2 className="text-2xl font-extrabold mb-1 text-purple-700 tracking-tight drop-shadow-sm">
              {initialData ? "Edit Document" : "Add New Document"}
            </h2>
            <div className="h-1 w-24 bg-gradient-to-r from-purple-400 via-pink-400 to-purple-600 rounded-full mb-3" />
            <p className="mb-4 text-gray-500 text-sm">Fill in the details below to add a new document entry.</p>
          </div>
          
          <div className="flex-1 overflow-y-auto px-4 pb-8">
            <form onSubmit={handleSubmit} className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-x-8 gap-y-6 text-gray-800 bg-white/70 rounded-2xl p-6 shadow-lg ring-1 ring-purple-50">
              
              {/* Basic Information Section */}
              <div className="lg:col-span-3 sm:col-span-2 col-span-1">
                <div className="flex items-center gap-2 mb-4">
                  <span className="text-lg font-semibold text-purple-600">Basic Information</span>
                  <div className="flex-1 h-px bg-gradient-to-r from-purple-200 via-pink-200 to-transparent" />
                </div>
              </div>
              
          
              <div className="lg:col-span-2">
                <label className="block text-xs font-semibold mb-1 text-gray-700">
                  Document Title <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  name="title"
                  value={form.title}
                  onChange={handleChange}
                  required
                  disabled={isUploading}
                  className={`w-full border-2 border-purple-200 rounded-xl px-4 py-2 focus:outline-none focus:ring-2 focus:ring-pink-400 placeholder:text-gray-400 text-base text-gray-800 shadow-md transition-all duration-200 ${
                    isUploading ? 'bg-gray-100 cursor-not-allowed' : 'bg-purple-50/80'
                  }`}
                  placeholder="Enter document title"
                />
              </div>
              
              {/* Submitter Name */}
              <div>
                <label className="text-xs font-semibold mb-1 text-gray-700 flex items-center gap-2">
                  <FaUser className="text-purple-400" /> Submitter Name <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  name="submitterName"
                  value={form.submitterName}
                  onChange={handleChange}
                  required
                  disabled={isUploading}
                  className={`w-full border-2 border-purple-200 rounded-xl px-4 py-2 focus:outline-none focus:ring-2 focus:ring-pink-400 placeholder:text-gray-400 text-base text-gray-800 shadow-md transition-all duration-200 ${
                    isUploading ? 'bg-gray-100 cursor-not-allowed' : 'bg-purple-50/80'
                  }`}
                  placeholder="Enter submitter name"
                />
              </div>
              
              {/* Link Data */}
              <div className="lg:col-span-2">
                <label className="text-xs font-semibold mb-1 text-gray-700 flex items-center gap-2">
                  <FaLink className="text-purple-400" /> Link Data
                </label>
                <input
                  type="url"
                  name="linkData"
                  value={form.linkData}
                  onChange={handleChange}
                  disabled={isUploading}
                  className={`w-full border rounded-xl px-4 py-2 focus:outline-none focus:ring-2 focus:ring-purple-400 placeholder:text-gray-400 text-sm text-gray-800 shadow transition-all duration-200 ${
                    isUploading ? 'bg-gray-100 cursor-not-allowed' : 'bg-purple-50/60'
                  }`}
                  placeholder="https://example.com"
                />
              </div>
              
              {/* Category */}
              <div>
                <label className="block text-xs font-semibold mb-1 text-gray-700">Category</label>
                <select
                  name="category"
                  value={form.category}
                  onChange={handleChange}
                  disabled={isUploading}
                  className={`w-full border rounded-xl px-4 py-2 focus:outline-none focus:ring-2 focus:ring-purple-400 text-sm text-gray-800 shadow transition-all duration-200 ${
                    isUploading ? 'bg-gray-100 cursor-not-allowed' : 'bg-purple-50/60'
                  }`}
                >
                  <option value="">Select Category</option>
                  <option value="Report">Report</option>
                  <option value="Contract">Contract</option>
                  <option value="Invoice">Invoice</option>
                  <option value="Presentation">Presentation</option>
                  <option value="Image">Image</option>
                  <option value="Other">Other</option>
                </select>
              </div>
              
              {/* Text Data */}
              <div className="lg:col-span-3 sm:col-span-2">
                <label className="text-xs font-semibold mb-1 text-gray-700 flex items-center gap-2">
                  <FaAlignLeft className="text-purple-400" /> Text Data
                </label>
                <textarea
                  name="textData"
                  value={form.textData}
                  onChange={handleChange}
                  disabled={isUploading}
                  className={`w-full border rounded-xl px-4 py-2 focus:outline-none focus:ring-2 focus:ring-purple-400 placeholder:text-gray-400 text-sm text-gray-800 shadow transition-all duration-200 ${
                    isUploading ? 'bg-gray-100 cursor-not-allowed' : 'bg-purple-50/60'
                  }`}
                  placeholder="Enter any text data or description..."
                  rows={4}
                />
              </div>
              
              {/* File Upload Section */}
              <div className="lg:col-span-3 sm:col-span-2 col-span-1">
                <div className="flex items-center gap-2 mb-4">
                  <span className="text-lg font-semibold text-purple-600">File Upload</span>
                  <div className="flex-1 h-px bg-gradient-to-r from-purple-200 via-pink-200 to-transparent" />
                </div>
                
                <div className="border-2 border-dashed border-purple-300 rounded-xl p-6 text-center">
                  <FaFileUpload className="mx-auto text-purple-400 text-3xl mb-2" />
                  <p className="text-gray-600 mb-3">Upload your media</p>
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={isUploading}
                    className={`bg-purple-500 hover:bg-purple-600 text-white px-4 py-2 rounded-lg transition-colors ${
                      isUploading ? 'opacity-50 cursor-not-allowed' : ''
                    }`}
                  >
                    Choose Files
                  </button>
                  <input
                    ref={fileInputRef}
                    type="file"
                    multiple
                    onChange={handleFileUpload}
                    className="hidden"
                    accept=".pdf,.doc,.docx,.txt,.jpg,.jpeg,.png,.gif,.mp4,.avi,.mov,.wmv,.flv,.webm,.mp3,.wav,.aac,.flac,.ogg,.m4a"
                  />
                </div>
                
                {/* Display uploaded files */}
                {uploadedFiles.length > 0 && (
                  <div className="mt-4">
                    <h4 className="text-sm font-semibold text-gray-700 mb-2">
                      {uploadResults.failed.length > 0 ? 'Files to Retry:' : 'Uploaded Files:'}
                    </h4>
                    <div className="space-y-2">
                      {uploadedFiles.map((file, index) => {
                        const failedFile = uploadResults.failed.find(f => f.file.name === file.name);
                        return (
                          <div key={index} className={`flex items-center justify-between p-2 rounded-lg ${
                            failedFile ? 'bg-red-50 border border-red-200' : 'bg-purple-50'
                          }`}>
                            <div className="flex items-center gap-2">
                              <span className="text-sm text-gray-700">{file.name}</span>
                              {failedFile && (
                                <span className="text-xs text-red-600 bg-red-100 px-2 py-1 rounded">
                                  Failed
                                </span>
                              )}
                            </div>
                            <button
                              type="button"
                              onClick={() => handleRemoveFile(index)}
                              disabled={isUploading}
                              className={`text-red-500 hover:text-red-700 text-sm ${
                                isUploading ? 'opacity-50 cursor-not-allowed' : ''
                              }`}
                            >
                              Remove
                            </button>
                          </div>
                        );
                      })}
                    </div>
                    {uploadResults.successful.length > 0 && (
                      <div className="mt-3 p-2 bg-green-50 border border-green-200 rounded-lg">
                        <p className="text-sm text-green-700">
                          ✅ {uploadResults.successful.length} file(s) uploaded successfully
                        </p>
                      </div>
                    )}
                  </div>
                )}
              </div>
              
              {/* Additional Information Section */}
              <div className="lg:col-span-3 sm:col-span-2 col-span-1">
                <div className="flex items-center gap-2 mb-4">
                  <span className="text-lg font-semibold text-purple-600">Additional Information</span>
                  <div className="flex-1 h-px bg-gradient-to-r from-purple-200 via-pink-200 to-transparent" />
                </div>
              </div>
              
              {/* Tags */}
              <div className="lg:col-span-2">
                <label className="text-xs font-semibold mb-1 text-gray-700 flex items-center gap-2">
                  <FaTags className="text-purple-400" /> Tags
                </label>
                <input
                  type="text"
                  name="tags"
                  value={form.tags}
                  onChange={handleChange}
                  disabled={isUploading}
                  className={`w-full border rounded-xl px-4 py-2 focus:outline-none focus:ring-2 focus:ring-purple-400 placeholder:text-gray-400 text-sm text-gray-800 shadow transition-all duration-200 ${
                    isUploading ? 'bg-gray-100 cursor-not-allowed' : 'bg-purple-50/60'
                  }`}
                  placeholder="e.g. important, urgent, review (comma separated)"
                />
              </div>
              
              {/* Created Date */}
              <div>
                <label className="text-xs font-semibold mb-1 text-gray-700 flex items-center gap-2">
                  <FaCalendarAlt className="text-purple-400" /> Created Date
                </label>
                <input
                  type="text"
                  value={new Date(form.createdAt).toLocaleDateString()}
                  readOnly
                  className="w-full border rounded-xl px-4 py-2 bg-gray-100 text-gray-500 text-sm cursor-not-allowed"
                />
              </div>
              
              {/* Notes */}
              <div className="lg:col-span-3 sm:col-span-2">
                <label className="block text-xs font-semibold mb-1 text-gray-700">Notes</label>
                <textarea
                  name="notes"
                  value={form.notes}
                  onChange={handleChange}
                  disabled={isUploading}
                  className={`w-full border rounded-xl px-4 py-2 focus:outline-none focus:ring-2 focus:ring-purple-400 placeholder:text-gray-400 text-sm text-gray-800 shadow transition-all duration-200 ${
                    isUploading ? 'bg-gray-100 cursor-not-allowed' : 'bg-purple-50/60'
                  }`}
                  placeholder="Any additional notes..."
                  rows={3}
                />
              </div>
              
              {/* Custom Fields */}
              <div className="lg:col-span-3 sm:col-span-2 col-span-1">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-semibold text-gray-700">Custom Fields</span>
                  <button
                    type="button"
                    onClick={handleAddCustomField}
                    disabled={isUploading}
                    className={`text-xs text-purple-600 hover:text-purple-800 font-semibold px-2 py-1 rounded-xl border border-purple-100 bg-purple-50 transition ${
                      isUploading ? 'opacity-50 cursor-not-allowed' : ''
                    }`}
                  >
                    + Add Field
                  </button>
                </div>
                
                {customFields.map((field, idx) => (
                  <div key={idx} className="grid grid-cols-1 sm:grid-cols-2 gap-2 mb-2">
                    <input
                      type="text"
                      placeholder="Field name"
                      value={field.question}
                      onChange={e => handleCustomFieldChange(idx, 'question', e.target.value)}
                      disabled={isUploading}
                      className={`w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-400 ${
                        isUploading ? 'bg-gray-100 cursor-not-allowed' : ''
                      }`}
                    />
                    <div className="flex gap-2">
                      <input
                        type="text"
                        placeholder="Field value"
                        value={field.answer}
                        onChange={e => handleCustomFieldChange(idx, 'answer', e.target.value)}
                        disabled={isUploading}
                        className={`flex-1 border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-400 ${
                          isUploading ? 'bg-gray-100 cursor-not-allowed' : ''
                        }`}
                      />
                      <button
                        type="button"
                        onClick={() => handleRemoveCustomField(idx)}
                        disabled={isUploading}
                        className={`text-red-500 hover:text-red-700 px-2 rounded-full bg-red-50 hover:bg-red-100 transition ${
                          isUploading ? 'opacity-50 cursor-not-allowed' : ''
                        }`}
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      </button>
                    </div>
                  </div>
                ))}
              </div>
              
              {/* Error Display */}
              {error && (
                <div className="lg:col-span-3 sm:col-span-2 w-full bg-red-50 border border-red-200 rounded-xl p-4 mb-4">
                  <div className="flex items-center gap-2">
                    <svg className="w-5 h-5 text-red-500" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    <span className="text-red-700 font-medium">{error}</span>
                  </div>
                </div>
              )}
              
              {/* Submit Button */}
              <button
                type="submit"
                disabled={isUploading}
                className={`lg:col-span-3 sm:col-span-2 w-full bg-gradient-to-r from-purple-500 to-purple-700 hover:from-purple-600 hover:to-purple-800 text-white font-semibold py-3 rounded-2xl transition text-base shadow-xl mt-4 tracking-wide ${
                  isUploading ? 'opacity-50 cursor-not-allowed' : ''
                }`}
              >
                {isUploading ? (
                  <span className="flex items-center justify-center gap-2">
                    <svg className="animate-spin h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    Uploading...
                  </span>
                ) : (
                  initialData ? "Update Document" : "Add Document"
                )}
              </button>
              
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}
