import type React from "react"

import { FileIcon, UploadIcon } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

interface AttachmentsSectionProps {
  files: File[]
  setFiles: (files: File[]) => void
}

export function AttachmentsSection({ files, setFiles }: AttachmentsSectionProps) {
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const newFiles = Array.from(e.target.files)

      // Filter out duplicates based on file name and size
      const uniqueNewFiles = newFiles.filter((newFile) => {
        return !files.some((existingFile) => existingFile.name === newFile.name && existingFile.size === newFile.size)
      })

      // Add only unique files to the existing files array
      setFiles([...files, ...uniqueNewFiles])
    }
  }

  const removeFile = (indexToRemove: number) => {
    setFiles((prevFiles) => prevFiles.filter((_, index) => index !== indexToRemove))
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Attachments</CardTitle>
        <CardDescription>Upload screenshots or relevant files</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid w-full items-center gap-1.5">
          <Label htmlFor="files">Upload Files</Label>
          <div className="flex w-full flex-col items-center justify-center rounded-md border border-dashed border-muted-foreground/25 px-6 py-8 text-center">
            <UploadIcon className="h-8 w-8 text-muted-foreground" />
            <div className="mt-4 flex flex-col items-center">
              <p className="mb-2 text-sm text-muted-foreground">Drag and drop files here or click to browse</p>
              <Input id="files" type="file" multiple className="hidden" onChange={handleFileChange} />
              <Button
                type="button"
                variant="secondary"
                size="sm"
                onClick={() => document.getElementById("files")?.click()}
              >
                Select Files
              </Button>
            </div>
          </div>
        </div>

        {files.length > 0 && (
          <div className="space-y-2">
            <Label>Selected Files</Label>
            <div className="space-y-2 max-h-40 overflow-y-auto">
              {files.map((file, index) => (
                <div key={index} className="flex items-center justify-between gap-2 rounded-md border p-2">
                  <div className="flex items-center gap-2 overflow-hidden">
                    <FileIcon className="h-4 w-4 shrink-0 text-muted-foreground" />
                    <span className="text-sm truncate">{file.name}</span>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-6 w-6 p-0 text-muted-foreground hover:text-destructive"
                    onClick={() => removeFile(index)}
                  >
                    <span className="sr-only">Remove file</span>
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      width="16"
                      height="16"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      className="lucide lucide-x"
                    >
                      <path d="M18 6 6 18" />
                      <path d="m6 6 12 12" />
                    </svg>
                  </Button>
                </div>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
