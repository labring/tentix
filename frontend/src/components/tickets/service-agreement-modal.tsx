import { useState, useEffect } from "react"
import { CheckIcon, ClockIcon } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { ScrollArea } from "@/components/ui/scroll-area"

interface ServiceAgreementModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onConfirm: () => void
}

export function ServiceAgreementModal({ open, onOpenChange, onConfirm }: ServiceAgreementModalProps) {
  const [countdown, setCountdown] = useState<number>(3)
  const [countdownActive, setCountdownActive] = useState<boolean>(false)

  // Countdown timer effect
  useEffect(() => {
    let timer: NodeJS.Timeout
    if (countdownActive && countdown > 0) {
      timer = setTimeout(() => {
        setCountdown(countdown - 1)
      }, 1000)
    }
    return () => {
      if (timer) clearTimeout(timer)
    }
  }, [countdown, countdownActive])

  // Reset countdown when modal opens
  useEffect(() => {
    if (open) {
      setCountdown(3)
      setCountdownActive(true)
    } else {
      setCountdownActive(false)
    }
  }, [open])

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[80vh]">
        <DialogHeader>
          <DialogTitle>Ticket Service Agreement</DialogTitle>
          <DialogDescription>
            Please read the following agreement carefully before submitting a ticket
          </DialogDescription>
        </DialogHeader>

        <ScrollArea className="h-[50vh] pr-4">
          <div className="space-y-4 text-sm">
            <h3 className="text-lg font-semibold">1. Introduction</h3>
            <p>
              This Ticket Service Agreement ("Agreement") is entered into between you ("User") and our company ("Service
              Provider"). By submitting a support ticket, you acknowledge that you have read, understood, and agree to
              be bound by the terms and conditions of this Agreement.
            </p>

            <h3 className="text-lg font-semibold">2. Service Description</h3>
            <p>
              The Service Provider offers technical support services through a ticket system. Users can submit requests
              for assistance with technical issues, feature requests, or general inquiries related to our products and
              services.
            </p>

            <h3 className="text-lg font-semibold">3. User Responsibilities</h3>
            <p>3.1. Users must provide accurate and complete information when submitting a ticket.</p>
            <p>3.2. Users must respond to requests for additional information in a timely manner.</p>
            <p>3.3. Users must not submit tickets containing offensive, harmful, or illegal content.</p>
            <p>
              3.4. Users must not use the ticket system to engage in any activity that violates applicable laws or
              regulations.
            </p>

            <h3 className="text-lg font-semibold">4. Service Level Expectations</h3>
            <p>
              4.1. The Service Provider will make reasonable efforts to respond to tickets within the timeframes
              specified for each priority level.
            </p>
            <p>
              4.2. Response times are not guaranteed and may vary based on ticket volume, complexity, and available
              resources.
            </p>
            <p>
              4.3. The Service Provider reserves the right to prioritize tickets based on severity, impact, and other
              factors.
            </p>

            <h3 className="text-lg font-semibold">5. Data Privacy</h3>
            <p>
              5.1. The Service Provider will collect and process personal information in accordance with its Privacy
              Policy.
            </p>
            <p>
              5.2. By submitting a ticket, Users consent to the collection and processing of their personal information
              for the purpose of providing support services.
            </p>
            <p>
              5.3. The Service Provider will take reasonable measures to protect the confidentiality and security of
              User information.
            </p>

            <h3 className="text-lg font-semibold">6. Intellectual Property</h3>
            <p>
              6.1. All content, materials, and information provided by the Service Provider through the ticket system
              are protected by intellectual property rights.
            </p>
            <p>
              6.2. Users may not reproduce, distribute, or use such content without the Service Provider's permission.
            </p>

            <h3 className="text-lg font-semibold">7. Limitation of Liability</h3>
            <p>
              7.1. The Service Provider shall not be liable for any direct, indirect, incidental, special, or
              consequential damages arising from the use of the ticket system or the provision of support services.
            </p>
            <p>
              7.2. The Service Provider does not guarantee that all issues can be resolved or that solutions will meet
              the User's specific requirements.
            </p>

            <h3 className="text-lg font-semibold">8. Termination</h3>
            <p>
              8.1. The Service Provider reserves the right to suspend or terminate access to the ticket system for Users
              who violate this Agreement.
            </p>
            <p>
              8.2. The Service Provider may discontinue or modify the ticket system at any time without prior notice.
            </p>

            <h3 className="text-lg font-semibold">9. Governing Law</h3>
            <p>
              This Agreement shall be governed by and construed in accordance with the laws of the jurisdiction in which
              the Service Provider is established, without regard to its conflict of law provisions.
            </p>

            <h3 className="text-lg font-semibold">10. Amendments</h3>
            <p>
              The Service Provider reserves the right to modify this Agreement at any time. Users will be notified of
              significant changes. Continued use of the ticket system after such modifications constitutes acceptance of
              the revised Agreement.
            </p>
          </div>
        </ScrollArea>

        <DialogFooter className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <ClockIcon className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm text-muted-foreground">
              {countdown > 0 ? `Please wait ${countdown} seconds before agreeing` : "You can now agree to the terms"}
            </span>
          </div>
          <Button onClick={onConfirm} disabled={countdown > 0} className="min-w-[120px]">
            {countdown > 0 ? (
              <span className="flex items-center gap-2">
                <span>{countdown}</span>
                <ClockIcon className="h-4 w-4 animate-pulse" />
              </span>
            ) : (
              <span className="flex items-center gap-2">
                <span>I Agree</span>
                <CheckIcon className="h-4 w-4" />
              </span>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
