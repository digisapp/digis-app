import React, { useState, useRef, useCallback } from 'react';
import { Upload, X, FileText, Image, Video, Music, File, AlertCircle, CheckCircle } from 'lucide-react';
import storageClient from '../utils/storage-client';

const FileUpload = ({
  onUpload,
  onError,
  accept = '*/*',
  maxSize = 100 * 1024 * 1024, // 100MB default
  maxFiles = 1,
  bucket = null,
  endpoint = null,
  showPreview = true,
  className = '',
  buttonText = 'Choose Files',
  dropzoneText = 'Drop files here or click to browse'
}) => {
  const [files, setFiles] = useState([]);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState({});
  const [errors, setErrors] = useState([]);
  const fileInputRef = useRef(null);
  const [dragActive, setDragActive] = useState(false);

  const getFileIcon = (file) => {
    const type = file.type.split('/')[0];
    switch (type) {
      case 'image': return <Image className="w-5 h-5" />;
      case 'video': return <Video className="w-5 h-5" />;
      case 'audio': return <Music className="w-5 h-5" />;
      case 'text': return <FileText className="w-5 h-5" />;
      default: return <File className="w-5 h-5" />;
    }
  };

  const handleDrag = useCallback((e) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  }, []);

  const handleDrop = useCallback((e) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFiles(Array.from(e.dataTransfer.files));
    }
  }, []);

  const handleFiles = (newFiles) => {
    setErrors([]);
    
    // Validate files
    const validFiles = [];
    const fileErrors = [];
    
    newFiles.forEach(file => {
      // Check max files
      if (files.length + validFiles.length >= maxFiles) {
        fileErrors.push(`Maximum ${maxFiles} file(s) allowed`);
        return;
      }
      
      // Validate file
      const validation = storageClient.validateFile(file, {
        maxSize,
        acceptedTypes: accept === '*/*' ? null : accept.split(',').map(t => t.trim())
      });
      
      if (validation.valid) {
        // Add preview for images
        if (file.type.startsWith('image/') && showPreview) {
          const reader = new FileReader();
          reader.onload = (e) => {
            file.preview = e.target.result;
            setFiles(prev => [...prev]);
          };
          reader.readAsDataURL(file);
        }
        validFiles.push(file);
      } else {
        fileErrors.push(`${file.name}: ${validation.errors.join(', ')}`);
      }
    });
    
    if (fileErrors.length > 0) {
      setErrors(fileErrors);
    }
    
    if (validFiles.length > 0) {
      setFiles(prev => [...prev, ...validFiles]);
    }
  };

  const removeFile = (index) => {
    setFiles(prev => prev.filter((_, i) => i !== index));
    setUploadProgress(prev => {
      const newProgress = { ...prev };
      delete newProgress[index];
      return newProgress;
    });
  };

  const uploadFiles = async () => {
    if (files.length === 0) return;
    
    setUploading(true);
    setErrors([]);
    
    try {
      const uploadPromises = files.map(async (file, index) => {
        try {
          // Track progress
          const onProgress = (progress) => {
            setUploadProgress(prev => ({
              ...prev,
              [index]: progress
            }));
          };
          
          let result;
          
          if (endpoint) {
            // Upload via API endpoint
            const formData = new FormData();
            formData.append('file', file);
            
            result = await storageClient.uploadWithProgress(
              endpoint,
              formData,
              onProgress
            );
          } else if (bucket) {
            // Direct upload to bucket
            const userId = (await storageClient.getAuthToken()).sub;
            const path = storageClient.generateFilePath(userId, file.name);
            
            result = await storageClient.uploadFile(bucket, path, file);
          } else {
            throw new Error('No upload endpoint or bucket specified');
          }
          
          return { file, result, success: true };
        } catch (error) {
          return { file, error: error.message, success: false };
        }
      });
      
      const results = await Promise.all(uploadPromises);
      
      // Separate successful and failed uploads
      const successful = results.filter(r => r.success);
      const failed = results.filter(r => !r.success);
      
      if (failed.length > 0) {
        setErrors(failed.map(f => `${f.file.name}: ${f.error}`));
      }
      
      if (successful.length > 0 && onUpload) {
        onUpload(successful.map(s => s.result));
      }
      
      // Clear successful files
      if (successful.length > 0) {
        setFiles([]);
        setUploadProgress({});
      }
    } catch (error) {
      const errorMessage = error.message || 'Upload failed';
      setErrors([errorMessage]);
      if (onError) {
        onError(error);
      }
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className={`file-upload ${className}`}>
      {/* Dropzone */}
      <div
        className={`
          border-2 border-dashed rounded-lg p-8 text-center transition-colors
          ${dragActive ? 'border-purple-500 bg-purple-50 dark:bg-purple-900/20' : 'border-gray-300 dark:border-gray-600'}
          ${uploading ? 'opacity-50 pointer-events-none' : 'cursor-pointer hover:border-purple-400'}
        `}
        onDragEnter={handleDrag}
        onDragLeave={handleDrag}
        onDragOver={handleDrag}
        onDrop={handleDrop}
        onClick={() => !uploading && fileInputRef.current?.click()}
      >
        <Upload className="w-12 h-12 mx-auto mb-4 text-gray-400" />
        <p className="text-gray-600 dark:text-gray-300 mb-2">{dropzoneText}</p>
        <button
          type="button"
          className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors"
          disabled={uploading}
        >
          {buttonText}
        </button>
        <p className="text-sm text-gray-500 mt-2">
          Max file size: {storageClient.formatFileSize(maxSize)}
        </p>
      </div>

      {/* Hidden file input */}
      <input
        ref={fileInputRef}
        type="file"
        accept={accept}
        multiple={maxFiles > 1}
        onChange={(e) => handleFiles(Array.from(e.target.files))}
        className="hidden"
      />

      {/* Error messages */}
      {errors.length > 0 && (
        <div className="mt-4 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
          <div className="flex items-start">
            <AlertCircle className="w-5 h-5 text-red-500 mt-0.5 mr-2 flex-shrink-0" />
            <div>
              <p className="text-sm font-medium text-red-800 dark:text-red-200">Upload errors:</p>
              <ul className="mt-1 text-sm text-red-700 dark:text-red-300 list-disc list-inside">
                {errors.map((error, index) => (
                  <li key={index}>{error}</li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      )}

      {/* File list */}
      {files.length > 0 && (
        <div className="mt-4 space-y-2">
          {files.map((file, index) => (
            <div
              key={index}
              className="flex items-center p-3 bg-gray-50 dark:bg-gray-800 rounded-lg"
            >
              {/* File preview or icon */}
              <div className="flex-shrink-0 mr-3">
                {file.preview ? (
                  <img
                    src={file.preview}
                    alt={file.name}
                    className="w-12 h-12 object-cover rounded"
                  />
                ) : (
                  getFileIcon(file)
                )}
              </div>

              {/* File info */}
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-gray-900 dark:text-white truncate">
                  {file.name}
                </p>
                <p className="text-xs text-gray-500">
                  {storageClient.formatFileSize(file.size)}
                </p>
                
                {/* Upload progress */}
                {uploadProgress[index] !== undefined && (
                  <div className="mt-1">
                    <div className="flex items-center">
                      <div className="flex-1 bg-gray-200 dark:bg-gray-700 rounded-full h-2 mr-2">
                        <div
                          className="bg-purple-600 h-2 rounded-full transition-all"
                          style={{ width: `${uploadProgress[index]}%` }}
                        />
                      </div>
                      <span className="text-xs text-gray-500">
                        {Math.round(uploadProgress[index])}%
                      </span>
                    </div>
                  </div>
                )}
              </div>

              {/* Remove button */}
              {!uploading && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    removeFile(index);
                  }}
                  className="ml-2 p-1 text-gray-400 hover:text-red-500 transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              )}
              
              {/* Success indicator */}
              {uploadProgress[index] === 100 && (
                <CheckCircle className="w-5 h-5 text-green-500 ml-2" />
              )}
            </div>
          ))}
        </div>
      )}

      {/* Upload button */}
      {files.length > 0 && !uploading && (
        <button
          onClick={uploadFiles}
          className="mt-4 w-full px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors"
        >
          Upload {files.length} file{files.length > 1 ? 's' : ''}
        </button>
      )}

      {/* Uploading indicator */}
      {uploading && (
        <div className="mt-4 text-center">
          <div className="inline-flex items-center px-4 py-2 bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300 rounded-lg">
            <svg className="animate-spin -ml-1 mr-3 h-5 w-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
            </svg>
            Uploading...
          </div>
        </div>
      )}
    </div>
  );
};

export default FileUpload;