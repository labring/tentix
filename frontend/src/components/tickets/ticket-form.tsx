import type React from "react"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Label } from "@/components/ui/label"
import { TicketDetailsSection } from "@/components/tickets/ticket-details-section"
import { AttachmentsSection } from "@/components/tickets/attachments-section"
import { ContactInfoSection } from "@/components/tickets/contact-info-section"
import { ServiceAgreementModal } from "@/components/tickets/service-agreement-modal"

interface TicketFormProps {
  onSubmit: (formData: any) => void
  preselectedCategory?: string | null
  preselectedProblemType?: string | null
}

export function TicketForm({ onSubmit, preselectedCategory, preselectedProblemType }: TicketFormProps) {
  const [ticketType, setTicketType] = useState<string>("bug")
  const [occurrenceDate, setOccurrenceDate] = useState<Date>()
  const [selectedResources, setSelectedResources] = useState<string[]>([])
  const [files, setFiles] = useState<File[]>([])
  const [contactTime, setContactTime] = useState<string>("anytime")
  const [specificStartTime, setSpecificStartTime] = useState<string>("09:00")
  const [specificEndTime, setSpecificEndTime] = useState<string>("17:00")
  const [ccEmails, setCcEmails] = useState<string[]>([])
  const [agreementChecked, setAgreementChecked] = useState<boolean>(false)
  const [agreementOpen, setAgreementOpen] = useState<boolean>(false)

  const handleAgreementClick = () => {
    if (!agreementChecked) {
      setAgreementOpen(true)
    }
  }

  const handleAgreementConfirm = () => {
    setAgreementChecked(true)
    setAgreementOpen(false)
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()

    // Collect all form data
    const formData = {
      ticketType,
      occurrenceDate,
      selectedResources,
      files,
      contactTime,
      specificStartTime,
      specificEndTime,
      ccEmails,
      category: preselectedCategory,
      problemType: preselectedProblemType,
    }

    onSubmit(formData)
  }

  return (
    <>
      <form onSubmit={handleSubmit}>
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          <TicketDetailsSection
            className="md:col-span-2 lg:col-span-2"
            ticketType={ticketType}
            setTicketType={setTicketType}
            occurrenceDate={occurrenceDate}
            setOccurrenceDate={setOccurrenceDate}
            selectedResources={selectedResources}
            setSelectedResources={setSelectedResources}
          />

          <div className="space-y-6">
            <AttachmentsSection files={files} setFiles={setFiles} />

            <ContactInfoSection
              contactTime={contactTime}
              setContactTime={setContactTime}
              specificStartTime={specificStartTime}
              setSpecificStartTime={setSpecificStartTime}
              specificEndTime={specificEndTime}
              setSpecificEndTime={setSpecificEndTime}
              ccEmails={ccEmails}
              setCcEmails={setCcEmails}
            />
          </div>
        </div>

        <div className="mt-6 flex items-start space-x-2">
          <Checkbox
            id="terms"
            required
            className="mt-1"
            checked={agreementChecked}
            onCheckedChange={handleAgreementClick}
          />
          <div className="grid gap-1.5 leading-none">
            <Label htmlFor="terms" className="font-normal text-sm">
              我已阅读并同意
              <Button
                variant="link"
                className="h-auto p-0 text-sm"
                onClick={(e) => {
                  e.preventDefault()
                  setAgreementOpen(true)
                }}
              >
                《工单服务协议》
              </Button>
              <span className="text-red-500 ml-1">*</span>
            </Label>
            <p className="text-xs text-muted-foreground">
              提交工单即表示您同意我们按照协议中的条款处理您的请求和个人信息
            </p>
          </div>
        </div>

        <div className="mt-6 flex justify-end gap-4">
          <Button variant="outline" type="button">
            Cancel
          </Button>
          <Button type="submit">Submit Ticket</Button>
        </div>
      </form>

      <ServiceAgreementModal open={agreementOpen} onOpenChange={setAgreementOpen} onConfirm={handleAgreementConfirm} />
    </>
  )
}
