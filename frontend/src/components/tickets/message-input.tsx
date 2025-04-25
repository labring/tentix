import type React from "react"

import { useRef, useState } from "react"
import { Loader2Icon, PaperclipIcon, SendIcon, XIcon } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"

interface MessageInputProps {
  onSendMessage: (content: string, files: File[]) => void
  isLoading: boolean
  ticketStatus: string
}

export function MessageInput({ onSendMessage, isLoading, ticketStatus }: MessageInputProps) {
  const [newMessage, setNewMessage] = useState("")
  const [files, setFiles] = useState<File[]>([])
  const fileInputRef = useRef<HTMLInputElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if ((!newMessage.trim() && files.length === 0) || isLoading || ticketStatus === "Completed") return

    onSendMessage(newMessage, files)
    setNewMessage("")
    setFiles([])
  }

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      setFiles((prevFiles) => [...prevFiles, ...Array.from(e.target.files || [])])
    }
  }

  const handleRemoveFile = (index: number) => {
    setFiles(files.filter((_, i) => i !== index))
  }

  return (
    <div className="border-t p-4 lg:p-6">
      <form onSubmit={handleSubmit} className="space-y-3">
        {files.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {files.map((file, index) => (
              <div
                key={index}
                className="flex items-center gap-1 rounded-full bg-muted px-3 py-1 text-xs animate-fadeIn"
              >
                <PaperclipIcon className="h-3 w-3" />
                <span className="max-w-[150px] truncate">{file.name}</span>
                <button
                  type="button"
                  className="ml-1 rounded-full p-0.5 hover:bg-muted-foreground/20"
                  onClick={() => handleRemoveFile(index)}
                >
                  <XIcon className="h-3 w-3" />
                  <span className="sr-only">Remove file</span>
                </button>
              </div>
            ))}
          </div>
        )}
        <div className="flex gap-2">
          <Input
            ref={inputRef}
            placeholder="Type your message..."
            value={newMessage}
            onChange={(e) => setNewMessage(e.target.value)}
            className="flex-1"
            disabled={isLoading || ticketStatus === "Completed"}
          />
          <input
            type="file"
            ref={fileInputRef}
            onChange={handleFileChange}
            className="hidden"
            multiple
            disabled={isLoading || ticketStatus === "Completed"}
          />
          <Button
            type="button"
            variant="outline"
            size="icon"
            onClick={() => fileInputRef.current?.click()}
            disabled={isLoading || ticketStatus === "Completed"}
          >
            <PaperclipIcon className="h-4 w-4" />
            <span className="sr-only">Attach file</span>
          </Button>
          <Button
            type="submit"
            size="icon"
            disabled={(!newMessage.trim() && files.length === 0) || isLoading || ticketStatus === "Completed"}
          >
            {isLoading ? <Loader2Icon className="h-4 w-4 animate-spin" /> : <SendIcon className="h-4 w-4" />}
            <span className="sr-only">Send message</span>
          </Button>
        </div>
        {ticketStatus === "Completed" && (
          <p className="text-center text-sm text-muted-foreground">
            This ticket has been resolved. You cannot send more messages.
          </p>
        )}
      </form>
    </div>
  )
}
