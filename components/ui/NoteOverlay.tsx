'use client'

import React, { useState, useEffect } from 'react'
import { Icon } from '@iconify/react'
import { useTranslations } from 'next-intl'
import { SerializedEditorState } from 'lexical'
import { Editor } from '@/components/blocks/editor-00/editor'
import { AddFieldModal, CustomField } from './AddFieldModal'
import { CommentSection, Comment } from './CommentSection'
import { NoteData, NoteFormData } from '../../types/note'

interface NoteFormOverlayProps {
  isOpen: boolean
  onClose: () => void
  onSave: (data: NoteFormData) => void
  onDuplicate?: (
    data: NoteFormData,
    position: { x: number; y: number; z: number }
  ) => void
  position?: { x: number; y: number; z: number }
  editingNote?: NoteData
}

export function NoteFormOverlay({
  isOpen,
  onClose,
  onSave,
  onDuplicate,
  position,
  editingNote,
}: NoteFormOverlayProps) {
  const t = useTranslations('Viewer')

  // Debug logging
  console.log('NoteFormOverlay props:', {
    isOpen,
    onDuplicate: !!onDuplicate,
    position: !!position,
    editingNote: !!editingNote,
    editingNoteData: editingNote,
  })

  const [formData, setFormData] = useState<NoteFormData>({
    title: '',
    description: '',
    urls: [],
    files: [],
    customFields: [],
  })
  const [isVisible, setIsVisible] = useState(true)
  const [isLocked, setIsLocked] = useState(true)
  const [newUrl, setNewUrl] = useState('')
  const [showAddFieldModal, setShowAddFieldModal] = useState(false)
  const [editingField, setEditingField] = useState<CustomField | null>(null)
  const [contextMenu, setContextMenu] = useState<{
    fieldId: string
    x: number
    y: number
  } | null>(null)
  const [previewFile, setPreviewFile] = useState<File | null>(null)
  const [comments, setComments] = useState<Comment[]>([])

  // Rich text editor state
  const [editorState, setEditorState] = useState<SerializedEditorState>({
    root: {
      children: [
        {
          children: [],
          direction: 'ltr',
          format: '',
          indent: 0,
          type: 'paragraph',
          version: 1,
        },
      ],
      direction: 'ltr',
      format: '',
      indent: 0,
      type: 'root',
      version: 1,
    },
  } as unknown as SerializedEditorState)

  // Helper function to convert plain text to editor state
  const createEditorStateFromText = (text: string): SerializedEditorState => {
    if (!text.trim()) {
      return {
        root: {
          children: [
            {
              children: [],
              direction: 'ltr',
              format: '',
              indent: 0,
              type: 'paragraph',
              version: 1,
            },
          ],
          direction: 'ltr',
          format: '',
          indent: 0,
          type: 'root',
          version: 1,
        },
      } as unknown as SerializedEditorState
    }

    return {
      root: {
        children: [
          {
            children: [
              {
                detail: 0,
                format: 0,
                mode: 'normal',
                style: '',
                text: text,
                type: 'text',
                version: 1,
              },
            ],
            direction: 'ltr',
            format: '',
            indent: 0,
            type: 'paragraph',
            version: 1,
          },
        ],
        direction: 'ltr',
        format: '',
        indent: 0,
        type: 'root',
        version: 1,
      },
    } as unknown as SerializedEditorState
  }

  // Helper function to extract plain text from editor state
  const extractTextFromEditorState = (state: SerializedEditorState): string => {
    try {
      const root = state.root
      if (!root || !root.children) return ''

      let text = ''
      const extractText = (node: any): void => {
        if (node.type === 'text') {
          text += node.text || ''
        } else if (node.type === 'image') {
          // For images, add a placeholder or description
          text += `[Image: ${node.altText || node.src || 'image'}]`
        } else if (node.children) {
          node.children.forEach(extractText)
          // Add line breaks for paragraph and heading nodes
          if (
            ['paragraph', 'heading', 'quote'].includes(node.type) &&
            text &&
            !text.endsWith('\n')
          ) {
            text += '\n'
          }
        }
      }

      root.children.forEach(extractText)
      return text.trim()
    } catch (error) {
      console.error('Error extracting text from editor state:', error)
      return ''
    }
  }

  // Reset comments when form opens for a new note, or populate when editing
  useEffect(() => {
    if (isOpen) {
      if (editingNote) {
        // Populate form with existing note data
        setFormData({
          title: editingNote.title || '',
          description: editingNote.description || '',
          urls: editingNote.urls || [],
          files: editingNote.files || [],
          customFields: editingNote.customFields || [],
        })
        setComments(editingNote.comments || [])
        setIsLocked(
          editingNote.isLocked !== undefined ? editingNote.isLocked : true
        )
        // Set editor state from rich content if available, otherwise from plain text
        if (editingNote.richDescription) {
          try {
            const parsedEditorState = JSON.parse(editingNote.richDescription)
            setEditorState(parsedEditorState)
          } catch (error) {
            console.error(
              'Error parsing rich description, falling back to plain text:',
              error
            )
            setEditorState(
              createEditorStateFromText(editingNote.description || '')
            )
          }
        } else {
          setEditorState(
            createEditorStateFromText(editingNote.description || '')
          )
        }
      } else {
        setFormData({
          title: '',
          description: '',
          urls: [],
          files: [],
          customFields: [],
        })
        setComments([])
        // Reset editor state
        setEditorState(createEditorStateFromText(''))
      }
    }
  }, [isOpen, editingNote])

  const handleInputChange = (
    field: keyof NoteFormData,
    value: string | string[] | File[]
  ) => {
    setFormData((prev) => ({
      ...prev,
      [field]: value,
    }))
  }

  const addUrl = () => {
    if (newUrl.trim()) {
      setFormData((prev) => ({
        ...prev,
        urls: [...prev.urls, newUrl.trim()],
      }))
      setNewUrl('')
    }
  }

  const removeUrl = (index: number) => {
    setFormData((prev) => ({
      ...prev,
      urls: prev.urls.filter((_, i) => i !== index),
    }))
  }

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || [])
    setFormData((prev) => ({
      ...prev,
      files: [...prev.files, ...files],
    }))
  }

  const removeFile = (index: number) => {
    setFormData((prev) => ({
      ...prev,
      files: prev.files.filter((_, i) => i !== index),
    }))
  }

  const handleSave = () => {
    if (!formData.title.trim()) {
      alert(t('marker-form-titleRequired'))
      return
    }

    // Store the rich content as JSON and also extract plain text for backwards compatibility
    const richDescription = JSON.stringify(editorState)
    const plainDescription = extractTextFromEditorState(editorState)

    // Include comments in the form data
    const dataToSave = {
      ...formData,
      description: plainDescription, // Plain text for search/display
      richDescription: richDescription, // Rich content for editing
      comments: comments,
      isLocked: isLocked,
    }

    console.log('Saving note with rich content:', {
      plainDescription,
      richDescription,
      editorState,
      dataToSave,
    })

    onSave(dataToSave)
    // Reset form
    setFormData({
      title: '',
      description: '',
      urls: [],
      files: [],
      customFields: [],
    })
    setIsVisible(true)
    setIsLocked(true)
    setNewUrl('')
    setComments([]) // Reset comments
    setEditorState(createEditorStateFromText('')) // Reset editor
  }

  const handleDuplicateNote = () => {
    if (!onDuplicate) {
      console.warn('no onDuplicate callback')
      return
    }

    if (!editingNote) {
      console.warn('not editing an existing note')
      return
    }

    if (!position) {
      console.warn('no position provided')
      return
    }

    // Calculate offset position (2 units offset in x and y)
    const offsetPosition = {
      x: position.x + 2,
      y: position.y + 2,
      z: position.z,
    }

    // Copy the data (Title, Field contents, Description, Related links - no files)
    const duplicatedData: NoteFormData = {
      title: `Copy of ${formData.title}`,
      description: extractTextFromEditorState(editorState), // Extract from editor state
      urls: formData.urls, // Related links
      customFields: formData.customFields, // Field contents
      files: [], // No files copied
    }

    console.log('Duplicating note:', { duplicatedData, offsetPosition })
    onDuplicate(duplicatedData, offsetPosition)

    // Close the panel after duplication
    onClose()
  }

  const handleCancel = () => {
    onClose()
    // Reset form
    setFormData({
      title: '',
      description: '',
      urls: [],
      files: [],
      customFields: [],
    })
    setIsVisible(true)
    setIsLocked(true)
    setNewUrl('')
    setComments([]) // Reset comments
    setEditorState(createEditorStateFromText('')) // Reset editor
  }

  // Custom field management
  const handleAddField = (field: CustomField) => {
    if (editingField) {
      // Edit existing field
      setFormData((prev) => ({
        ...prev,
        customFields: prev.customFields.map((f) =>
          f.id === editingField.id ? { ...field, id: editingField.id } : f
        ),
      }))
      setEditingField(null)
    } else {
      // Add new field
      setFormData((prev) => ({
        ...prev,
        customFields: [...prev.customFields, field],
      }))
    }
  }

  const removeCustomField = (fieldId: string) => {
    setFormData((prev) => ({
      ...prev,
      customFields: prev.customFields.filter((field) => field.id !== fieldId),
    }))
  }

  const updateCustomFieldValue = (
    fieldId: string,
    value: CustomField['value']
  ) => {
    setFormData((prev) => ({
      ...prev,
      customFields: prev.customFields.map((field) =>
        field.id === fieldId ? { ...field, value } : field
      ),
    }))
  }

  // Context menu handlers
  const handleFieldNameClick = (
    field: CustomField,
    event: React.MouseEvent
  ) => {
    console.log('Field name clicked:', field.name)
    event.preventDefault()
    event.stopPropagation()
    const rect = (event.target as HTMLElement).getBoundingClientRect()
    setContextMenu({
      fieldId: field.id,
      x: rect.left,
      y: rect.bottom + 5,
    })
    console.log('Context menu set:', {
      fieldId: field.id,
      x: rect.left,
      y: rect.bottom + 5,
    })
  }

  const handleEditField = (fieldId: string) => {
    const field = formData.customFields.find((f) => f.id === fieldId)
    if (field) {
      setEditingField(field)
      setShowAddFieldModal(true)
    }
    setContextMenu(null)
  }

  const handleRemoveFieldFromMenu = (fieldId: string) => {
    removeCustomField(fieldId)
    setContextMenu(null)
  }

  const closeContextMenu = () => {
    setContextMenu(null)
  }

  // File preview functionality
  const isPreviewableFile = (file: File): boolean => {
    const previewableTypes = [
      'image/jpeg',
      'image/jpg',
      'image/png',
      'image/gif',
      'image/webp',
      'image/svg+xml',
      'application/pdf',
      'text/plain',
      'text/csv',
      'application/json',
    ]
    return previewableTypes.includes(file.type)
  }

  const handleFilePreview = (file: File) => {
    if (isPreviewableFile(file)) {
      if (file.type === 'application/pdf' || file.type.startsWith('image/')) {
        // Create object URL and open in new tab for PDF and images
        const url = URL.createObjectURL(file)
        window.open(url, '_blank')
        // Clean up the URL after a delay
        setTimeout(() => URL.revokeObjectURL(url), 100)
      } else if (
        file.type.startsWith('text/') ||
        file.type === 'application/json'
      ) {
        // For text files, set preview file to show in modal
        setPreviewFile(file)
      }
    }
  }

  const getFileIcon = (file: File): string => {
    if (file.type.startsWith('image/')) return 'solar:gallery-bold'
    if (file.type === 'application/pdf') return 'solar:file-text-bold'
    if (file.type.startsWith('text/')) return 'solar:document-text-bold'
    if (file.type === 'application/json') return 'solar:code-file-bold'
    return 'solar:file-bold'
  }

  const handleAddComment = (content: string) => {
    const newComment: Comment = {
      id: Date.now().toString(),
      userId: 'current-user',
      userName: 'ユーザー名',
      content,
      timestamp: new Date(),
    }
    setComments((prev) => [...prev, newComment])
  }

  // Helper function to get string value for form inputs
  const getStringValue = (value: CustomField['value']): string => {
    if (typeof value === 'string') return value
    if (typeof value === 'number') return value.toString()
    if (value instanceof Date) return value.toISOString().split('T')[0] // For date inputs
    return ''
  }

  const renderCustomField = (field: CustomField) => {
    switch (field.type) {
      case 'selection':
        return (
          <div className="relative block w-full">
            <select
              className="p-3 border border-gray-300 rounded-lg text-sm transition-colors duration-200 ease-in-out cursor-pointer focus:outline-none focus:border-primary focus:shadow-[0_0_0_3px_rgba(56,112,213,0.1)] placeholder:text-gray-400 appearance-none w-full pr-10"
              value={typeof field.value === 'string' ? field.value : ''}
              onChange={(e) => updateCustomFieldValue(field.id, e.target.value)}
            >
              <option value="">{t('marker-form-selectPlaceholder')}</option>
              {field.options?.map((option, index) => (
                <option key={index} value={option}>
                  {option}
                </option>
              ))}
            </select>
            <Icon
              icon="solar:alt-arrow-down-bold"
              width="16"
              height="16"
              className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-500 pointer-events-none z-10"
            />
          </div>
        )

      case 'multipleSelection':
        console.log(
          'Rendering multipleSelection field:',
          field.name,
          'with options:',
          field.options,
          'and value:',
          field.value
        )
        return (
          <div className="flex flex-col gap-3">
            {field.options?.map((option, index) => {
              const currentValues = Array.isArray(field.value)
                ? field.value
                : []
              const isSelected = currentValues.includes(option)
              return (
                <button
                  key={index}
                  type="button"
                  className={`py-2 px-4 border border-gray-300 rounded-lg text-sm cursor-pointer transition-all duration-200 ease-in-out flex items-center justify-center ${
                    isSelected
                      ? 'bg-blue-100 border-blue-500 text-blue-700'
                      : 'bg-white text-gray-700 hover:bg-gray-50'
                  }`}
                  onClick={() => {
                    const newValues = isSelected
                      ? currentValues.filter((v) => v !== option)
                      : [...currentValues, option]
                    console.log(
                      'Updating multipleSelection field:',
                      field.id,
                      'new values:',
                      newValues
                    )
                    updateCustomFieldValue(field.id, newValues)
                  }}
                >
                  <span>{option}</span>
                </button>
              )
            })}
          </div>
        )

      case 'checkbox':
        const isChecked = field.value || false
        return (
          <button
            type="button"
            className={`py-2 px-4 border border-gray-300 rounded-lg text-sm cursor-pointer transition-all duration-200 ease-in-out flex items-center justify-center ${
              isChecked
                ? 'bg-blue-100 border-blue-500 text-blue-700'
                : 'bg-white text-gray-700 hover:bg-gray-50'
            }`}
            onClick={() => updateCustomFieldValue(field.id, !isChecked)}
          >
            <span>{field.name}</span>
          </button>
        )

      case 'date':
        return (
          <input
            type="date"
            className="p-3 border border-gray-300 rounded-lg text-sm transition-colors duration-200 ease-in-out focus:outline-none focus:border-primary focus:shadow-[0_0_0_3px_rgba(56,112,213,0.1)] placeholder:text-gray-400"
            value={getStringValue(field.value)}
            onChange={(e) => updateCustomFieldValue(field.id, e.target.value)}
          />
        )

      case 'member':
        return (
          <input
            type="text"
            className="p-3 border border-gray-300 rounded-lg text-sm transition-colors duration-200 ease-in-out focus:outline-none focus:border-primary focus:shadow-[0_0_0_3px_rgba(56,112,213,0.1)] placeholder:text-gray-400"
            value={getStringValue(field.value)}
            onChange={(e) => updateCustomFieldValue(field.id, e.target.value)}
            placeholder="メンバーを選択"
          />
        )

      case 'text':
        return (
          <input
            type="text"
            className="p-3 border border-gray-300 rounded-lg text-sm transition-colors duration-200 ease-in-out focus:outline-none focus:border-primary focus:shadow-[0_0_0_3px_rgba(56,112,213,0.1)] placeholder:text-gray-400"
            value={getStringValue(field.value)}
            onChange={(e) => updateCustomFieldValue(field.id, e.target.value)}
            placeholder="テキストを入力"
          />
        )

      case 'number':
        return (
          <input
            type="number"
            className="p-3 border border-gray-300 rounded-lg text-sm transition-colors duration-200 ease-in-out focus:outline-none focus:border-primary focus:shadow-[0_0_0_3px_rgba(56,112,213,0.1)] placeholder:text-gray-400"
            value={getStringValue(field.value)}
            onChange={(e) => updateCustomFieldValue(field.id, e.target.value)}
            placeholder="数値を入力"
          />
        )

      case 'url':
        return (
          <input
            type="url"
            className="p-3 border border-gray-300 rounded-lg text-sm transition-colors duration-200 ease-in-out focus:outline-none focus:border-primary focus:shadow-[0_0_0_3px_rgba(56,112,213,0.1)] placeholder:text-gray-400"
            value={getStringValue(field.value)}
            onChange={(e) => updateCustomFieldValue(field.id, e.target.value)}
            placeholder="URLを入力"
          />
        )

      default:
        return null
    }
  }

  return (
    <>
      {/* Backdrop */}
      <div
        className={`absolute top-0 left-0 right-0 bottom-0 bg-transparent z-[1200] transition-all duration-300 ease-in-out ${
          isOpen
            ? 'pointer-events-auto opacity-100 visible'
            : 'pointer-events-none opacity-0 invisible'
        }`}
        onClick={handleCancel}
      />

      {/* Panel */}
      <div
        className={`absolute top-0 right-0 w-[55%] h-full bg-white shadow-[-4px_0_20px_rgba(0,0,0,0.15)] z-[999999999] flex flex-col transition-all duration-[400ms] cubic-bezier(0.25,0.46,0.45,0.94) will-change-transform ${
          isOpen
            ? 'transform translate-x-0 pointer-events-auto visible'
            : 'transform translate-x-full pointer-events-none invisible'
        }`}
        onClick={(e) => {
          // Only close context menu if not clicking on field name button
          if (!(e.target as HTMLElement).closest('.fieldNameButton')) {
            closeContextMenu()
          }
        }}
      >
        {/* First row - Control buttons */}
        <div className="flex items-center justify-between py-4 px-6 border-b border-gray-200 bg-gray-50">
          <button
            className="bg-none border-none text-gray-500 cursor-pointer p-2 rounded transition-colors duration-200 ease-in-out flex items-center justify-center hover:text-gray-700"
            onClick={handleCancel}
          >
            <span className="material-icons">keyboard_double_arrow_right</span>
          </button>
          <div className="flex gap-2">
            <button
              className={`bg-none border-none cursor-pointer p-1.5 rounded transition-all duration-200 ease-in-out ${
                isVisible ? 'text-primary' : 'text-gray-400'
              }`}
              onClick={() => setIsVisible(!isVisible)}
            >
              <span
                className="material-icons"
                style={{
                  fontVariationSettings: isVisible
                    ? `'FILL' 1, 'wght' 400, 'GRAD' 0, 'opsz' 24`
                    : `'FILL' 1, 'wght' 400, 'GRAD' 0, 'opsz' 24`,
                }}
              >
                {isVisible ? 'visibility' : 'visibility_off'}
              </span>
            </button>
            <button
              className={`bg-none border-none cursor-pointer p-1.5 rounded transition-all duration-200 ease-in-out ${
                isLocked ? 'text-primary' : 'text-gray-400'
              }`}
              onClick={() => setIsLocked(!isLocked)}
            >
              <span
                className="material-icons"
                style={{
                  fontVariationSettings: `'FILL' 1, 'wght' 400, 'GRAD' 0, 'opsz' 24`,
                }}
              >
                {isLocked ? 'lock' : 'lock_open'}
              </span>
            </button>
            <button
              className={`bg-none border-none p-1.5 rounded transition-all duration-200 ease-in-out ${
                editingNote && onDuplicate && position
                  ? 'cursor-pointer text-gray-500 hover:text-gray-700'
                  : 'cursor-not-allowed text-gray-300'
              }`}
              onClick={() => {
                // console.log('dupe debug:', {
                //   editingNote: !!editingNote,
                //   onDuplicate: !!onDuplicate,
                //   position: !!position,
                //   allConditionsMet: !!(editingNote && onDuplicate && position)
                // });
                handleDuplicateNote()
              }}
              disabled={!editingNote || !onDuplicate || !position}
            >
              <span
                className="material-icons"
                style={{
                  fontVariationSettings: `'FILL' 1, 'wght' 400, 'GRAD' 0, 'opsz' 24`,
                }}
              >
                content_copy
              </span>
            </button>
          </div>
        </div>

        {/* Second row - Title and Save */}
        <div className="flex items-center gap-3 py-4 px-6 border-b border-gray-200">
          <input
            type="text"
            className="flex-1 py-3 px-4 border border-gray-300 rounded-lg text-base font-medium transition-colors duration-200 ease-in-out focus:outline-none focus:border-primary focus:shadow-[0_0_0_3px_rgba(56,112,213,0.1)] placeholder:text-gray-400 placeholder:font-normal"
            value={formData.title}
            onChange={(e) => {
              if (e.target.value.length <= 100) {
                handleInputChange('title', e.target.value)
              }
            }}
            placeholder={t('marker-form-titlePlaceholder')}
            maxLength={100}
            required
          />
          <button
            className="py-3 px-6 border-none rounded-lg text-sm font-medium cursor-pointer transition-all duration-200 ease-in-out bg-primary text-white hover:bg-blue-600 disabled:bg-gray-400 disabled:cursor-not-allowed"
            onClick={handleSave}
          >
            {t('save')}
          </button>
        </div>

        <div className="flex-1 py-6 px-6 overflow-y-auto">
          {/* Position info */}

          <form className="flex flex-col gap-5">
            {/* Add Field Button */}
            <div className="flex flex-col gap-2">
              <button
                type="button"
                className="flex items-center gap-2 w-full py-3 px-4 border-2 border-dashed border-gray-300 rounded-lg bg-transparent text-blue-500 text-sm font-medium cursor-pointer transition-all duration-200 ease-in-out hover:border-blue-500 hover:bg-blue-50 focus:outline-2 focus:outline-blue-500 focus:outline-offset-2"
                onClick={() => setShowAddFieldModal(true)}
              >
                {t('marker-form-addField')}
              </button>
            </div>

            {/* Custom Fields */}
            {formData.customFields.map((field) => (
              <div key={field.id} className="flex flex-col gap-2">
                <div className="flex items-center gap-2 mb-2">
                  <button
                    type="button"
                    className="fieldNameButton bg-none border-none text-left text-sm font-semibold text-gray-700 cursor-pointer p-0 m-0 mb-2 transition-colors duration-200 ease-in-out hover:text-blue-500"
                    onClick={(e) => handleFieldNameClick(field, e)}
                  >
                    {field.name}
                  </button>
                </div>
                {field.type !== 'checkbox' && renderCustomField(field)}
                {field.type === 'checkbox' && renderCustomField(field)}
              </div>
            ))}

            {/* Description */}
            <div className="flex flex-col gap-2">
              <label className="text-sm font-semibold text-gray-700">
                {t('marker-form-description')}
              </label>
              <div className="border border-gray-300 rounded-lg transition-colors duration-200 ease-in-out focus-within:border-primary focus-within:shadow-[0_0_0_3px_rgba(56,112,213,0.1)]">
                <Editor
                  editorSerializedState={editorState}
                  onSerializedChange={(value) => {
                    setEditorState(value)
                  }}
                />
              </div>
            </div>

            {/* URLs */}
            <div className="flex flex-col gap-2">
              <label className="text-sm font-semibold text-gray-700">
                {t('marker-form-urls')}
              </label>
              <div className="flex gap-2 items-center">
                <input
                  type="url"
                  className="flex-1 w-full p-3 border border-gray-300 rounded-lg text-sm transition-colors duration-200 ease-in-out focus:outline-none focus:border-primary focus:shadow-[0_0_0_3px_rgba(56,112,213,0.1)] placeholder:text-gray-400"
                  value={newUrl}
                  onChange={(e) => setNewUrl(e.target.value)}
                  placeholder={t('marker-form-urlPlaceholder')}
                  onKeyPress={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault()
                      addUrl()
                    }
                  }}
                />
              </div>
              {formData.urls.length > 0 && (
                <div className="flex flex-col gap-2 mt-2">
                  {formData.urls.map((url, index) => (
                    <div
                      key={index}
                      className="flex items-center gap-2 py-2 px-3 bg-gray-50 border border-gray-200 rounded-md transition-colors duration-200 ease-in-out hover:bg-gray-100"
                    >
                      <Icon icon="solar:link-bold" width="16" height="16" />
                      <a
                        href={url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex-1 text-primary text-sm whitespace-nowrap overflow-hidden text-ellipsis no-underline hover:underline"
                      >
                        {url}
                      </a>
                      <button
                        type="button"
                        className="bg-none border-none text-primary cursor-pointer p-0.5 rounded transition-all duration-200 ease-in-out flex items-center justify-center flex-shrink-0 hover:bg-red-100"
                        onClick={() => removeUrl(index)}
                      >
                        <Icon
                          icon="solar:close-circle-bold"
                          width="16"
                          height="16"
                        />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Files */}
            <div className="flex flex-col gap-2">
              <label className="text-sm font-semibold text-gray-700">
                {t('marker-form-files')}
              </label>
              <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center transition-all duration-200 ease-in-out cursor-pointer hover:border-primary hover:bg-slate-50">
                <input
                  type="file"
                  id="file-upload"
                  className="hidden"
                  multiple
                  onChange={handleFileUpload}
                />
                <label
                  htmlFor="file-upload"
                  className="flex flex-col items-center gap-2 cursor-pointer text-gray-500 text-sm"
                >
                  <Icon
                    icon="solar:upload-minimalistic-bold"
                    width="24"
                    height="24"
                    className="text-gray-400 hover:text-primary"
                  />
                  <span>{t('marker-form-uploadFiles')}</span>
                </label>
              </div>
              {formData.files.length > 0 && (
                <div className="flex flex-col gap-2 mt-2">
                  {formData.files.map((file, index) => (
                    <div
                      key={index}
                      className="flex items-center gap-2 py-2 px-3 bg-gray-50 border border-gray-200 rounded-md transition-colors duration-200 ease-in-out hover:bg-gray-100"
                    >
                      <Icon icon={getFileIcon(file)} width="16" height="16" />
                      <span
                        className={`flex-1 text-sm text-gray-700 whitespace-nowrap overflow-hidden text-ellipsis ${
                          isPreviewableFile(file)
                            ? 'text-blue-500 cursor-pointer underline hover:text-blue-700'
                            : ''
                        }`}
                        onClick={() => handleFilePreview(file)}
                        style={{
                          cursor: isPreviewableFile(file)
                            ? 'pointer'
                            : 'default',
                          textDecoration: isPreviewableFile(file)
                            ? 'underline'
                            : 'none',
                        }}
                        title={
                          isPreviewableFile(file) ? 'Click to preview' : ''
                        }
                      >
                        {file.name}
                      </span>
                      <span className="text-xs text-gray-500 flex-shrink-0">
                        ({(file.size / 1024).toFixed(1)} KB)
                      </span>
                      <button
                        type="button"
                        className="bg-none border-none text-primary cursor-pointer p-0.5 rounded transition-all duration-200 ease-in-out flex items-center justify-center flex-shrink-0 hover:bg-red-100"
                        onClick={() => removeFile(index)}
                      >
                        <Icon
                          icon="solar:close-circle-bold"
                          width="16"
                          height="16"
                        />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Comments */}
            <div className="flex flex-col gap-2">
              <CommentSection
                comments={comments}
                onAddComment={handleAddComment}
              />
            </div>
          </form>
        </div>
      </div>

      <AddFieldModal
        isOpen={showAddFieldModal}
        onClose={() => {
          setShowAddFieldModal(false)
          setEditingField(null)
        }}
        onAddField={handleAddField}
        editingField={editingField}
      />

      {/* Context Menu */}
      {contextMenu && (
        <>
          <div
            className="fixed top-0 left-0 right-0 bottom-0 z-[2000] bg-transparent"
            onClick={closeContextMenu}
          />
          <div
            className="fixed bg-white border border-gray-200 rounded-lg shadow-[0_10px_25px_rgba(0,0,0,0.15)] z-[2001] min-w-[120px] overflow-hidden"
            style={{
              left: contextMenu.x,
              top: contextMenu.y,
            }}
          >
            <button
              className="flex items-center gap-2 w-full py-3 px-4 border-none bg-white text-gray-700 text-sm cursor-pointer transition-colors duration-200 ease-in-out hover:bg-gray-100 border-b border-gray-100"
              onClick={() => handleEditField(contextMenu.fieldId)}
            >
              <Icon icon="solar:pen-bold" width="16" height="16" />
              Edit
            </button>
            <button
              className="flex items-center gap-2 w-full py-3 px-4 border-none bg-white text-gray-700 text-sm cursor-pointer transition-colors duration-200 ease-in-out hover:bg-gray-100"
              onClick={() => handleRemoveFieldFromMenu(contextMenu.fieldId)}
            >
              <Icon
                icon="solar:trash-bin-minimalistic-bold"
                width="16"
                height="16"
              />
              Remove
            </button>
          </div>
        </>
      )}

      {/* Text File Preview Modal */}
      {previewFile && (
        <div
          className="fixed top-0 left-0 right-0 bottom-0 bg-black/50 z-[2000] flex items-center justify-center p-5"
          onClick={() => setPreviewFile(null)}
        >
          <div
            className="bg-white rounded-xl shadow-[0_20px_40px_rgba(0,0,0,0.15)] max-w-[800px] max-h-[80vh] w-full flex flex-col overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between py-4 px-5 border-b border-gray-200 bg-gray-50">
              <h3 className="m-0 text-base font-semibold text-gray-800">
                {previewFile.name}
              </h3>
              <button
                className="bg-none border-none cursor-pointer text-gray-500 transition-colors duration-200 ease-in-out hover:text-gray-700"
                onClick={() => setPreviewFile(null)}
              >
                <Icon icon="solar:close-circle-bold" width="24" height="24" />
              </button>
            </div>
            <div className="p-0 overflow-auto flex-1">
              <TextFilePreview file={previewFile} />
            </div>
          </div>
        </div>
      )}
    </>
  )
}

// Text file preview component
function TextFilePreview({ file }: { file: File }) {
  const [content, setContent] = React.useState<string>('')
  const [loading, setLoading] = React.useState(true)

  React.useEffect(() => {
    const reader = new FileReader()
    reader.onload = (e) => {
      setContent((e.target?.result as string) || '')
      setLoading(false)
    }
    reader.onerror = () => {
      setContent('Error reading file')
      setLoading(false)
    }
    reader.readAsText(file)
  }, [file])

  if (loading) {
    return (
      <div style={{ padding: '20px', textAlign: 'center' }}>Loading...</div>
    )
  }

  return (
    <pre
      style={{
        whiteSpace: 'pre-wrap',
        fontSize: '14px',
        lineHeight: '1.5',
        margin: 0,
        padding: '16px',
        backgroundColor: '#f5f5f5',
        borderRadius: '8px',
        overflow: 'auto',
        maxHeight: '400px',
      }}
    >
      {content}
    </pre>
  )
}
