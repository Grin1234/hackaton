import { useState } from 'react'
import { useDropzone } from 'react-dropzone'
import { useNavigate } from 'react-router-dom'
import { uploadCode } from '../services/api'

export default function UploadPage() {
  const [file, setFile] = useState(null)
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState(null)
  const navigate = useNavigate()

  const onDrop = (acceptedFiles) => {
    if (acceptedFiles.length > 0) {
      setFile(acceptedFiles[0])
      setError(null)
    }
  }

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'text/*': ['.js', '.jsx', '.ts', '.tsx', '.py', '.java', '.cpp', '.c', '.go', '.rs', '.rb', '.php']
    },
    multiple: false
  })

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!file) {
      setError('Please select a file')
      return
    }

    setUploading(true)
    setError(null)

    try {
      const formData = new FormData()
      formData.append('codeFile', file)

      const response = await uploadCode(formData)
      
      if (response.success && response.review._id) {
        navigate(`/review/${response.review._id}`)
      } else {
        setError('Failed to create review')
      }
    } catch (err) {
      setError(err.response?.data?.error || err.message || 'Upload failed')
    } finally {
      setUploading(false)
    }
  }

  return (
    <div className="max-w-2xl mx-auto">
      <h1 className="text-2xl font-bold text-cursor-text-primary mb-4">Upload Code for Review</h1>
      
      <form onSubmit={handleSubmit} className="space-y-4">
        <div
          {...getRootProps()}
          className={`border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition ${
            isDragActive
              ? 'border-cursor-accent bg-cursor-accent bg-opacity-10'
              : 'border-cursor-border hover:border-cursor-accent bg-cursor-bg-secondary'
          }`}
        >
          <input {...getInputProps()} />
          {file ? (
            <div>
              <p className="text-sm font-medium text-cursor-text-primary">{file.name}</p>
              <p className="text-xs text-cursor-text-secondary mt-2">
                {(file.size / 1024).toFixed(2)} KB
              </p>
            </div>
          ) : (
            <div>
              <p className="text-sm text-cursor-text-primary mb-2">
                {isDragActive ? 'Drop the file here' : 'Drag & drop a code file here'}
              </p>
              <p className="text-xs text-cursor-text-secondary">or click to browse</p>
              <p className="text-xs text-cursor-text-muted mt-2">
                Supports: .js, .jsx, .ts, .tsx, .py, .java, .cpp, .c, .go, .rs, .rb, .php
              </p>
            </div>
          )}
        </div>

        {error && (
          <div className="bg-cursor-error bg-opacity-20 border border-cursor-error text-cursor-error px-4 py-3 rounded">
            {error}
          </div>
        )}

        <button
          type="submit"
          disabled={!file || uploading}
          className="w-full bg-cursor-accent text-white py-2 px-4 rounded-lg text-sm font-medium hover:bg-cursor-accent-hover disabled:bg-cursor-text-muted disabled:cursor-not-allowed transition"
        >
          {uploading ? 'Uploading and Reviewing...' : 'Start Review'}
        </button>
      </form>
    </div>
  )
}

