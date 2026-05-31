import { useState, useRef } from 'react'
import { useAuth } from '../context/AuthContext'
import '../styles/AvatarUpload.css'

export function AvatarUpload() {
  const { user, uploadAvatar, deleteAvatar, loading } = useAuth()
  const [error, setError] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    setError(null)
    const file = e.target.files?.[0]
    if (!file) return

    // Validate file type
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
      setError('Apenas JPEG, PNG e WebP são aceitos')
      return
    }

    // Validate file size (5MB)
    if (file.size > 5 * 1024 * 1024) {
      setError('Arquivo não pode exceder 5MB')
      return
    }

    try {
      await uploadAvatar(file)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao enviar avatar')
    }

    // Reset input
    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
  }

  const handleDelete = async () => {
    if (!user?.foto_avatar) return
    if (!confirm('Deseja remover seu avatar?')) return

    setError(null)
    try {
      await deleteAvatar()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao remover avatar')
    }
  }

  return (
    <div className="avatar-upload">
      <div className="avatar-display">
        {user?.foto_avatar ? (
          <img src={user.foto_avatar} alt="Avatar" className="avatar-image" />
        ) : (
          <div className="avatar-placeholder">Sem foto</div>
        )}
      </div>

      <div className="avatar-actions">
        <button
          onClick={() => fileInputRef.current?.click()}
          disabled={loading}
          className="btn-upload"
        >
          {loading ? 'Enviando...' : 'Alterar foto'}
        </button>

        {user?.foto_avatar && (
          <button
            onClick={handleDelete}
            disabled={loading}
            className="btn-delete"
          >
            {loading ? 'Removendo...' : 'Remover foto'}
          </button>
        )}

        <input
          ref={fileInputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          onChange={handleFileSelect}
          style={{ display: 'none' }}
        />
      </div>

      {error && <div className="error-message">{error}</div>}
    </div>
  )
}
