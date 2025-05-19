import { useState } from "react"
import { MailIcon, PhoneIcon } from "lucide-react"
import { Button } from "tentix-ui"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "tentix-ui"
import { Input } from "tentix-ui"
import { Label } from "tentix-ui"
import { RadioGroup, RadioGroupItem } from "tentix-ui"
import { Switch } from "tentix-ui"
import { Badge } from "tentix-ui"

interface ContactInfoSectionProps {
  contactTime: string
  setContactTime: (time: string) => void
  specificStartTime: string
  setSpecificStartTime: (time: string) => void
  specificEndTime: string
  setSpecificEndTime: (time: string) => void
  ccEmails: string[]
  setCcEmails: (emails: string[]) => void
}

export function ContactInfoSection({
  contactTime,
  setContactTime,
  specificStartTime,
  setSpecificStartTime,
  specificEndTime,
  setSpecificEndTime,
  ccEmails,
  setCcEmails,
}: ContactInfoSectionProps) {
  const [newCcEmail, setNewCcEmail] = useState<string>("")

  const addCcEmail = () => {
    if (newCcEmail && !ccEmails.includes(newCcEmail)) {
      setCcEmails([...ccEmails, newCcEmail])
      setNewCcEmail("")
    }
  }

  const removeCcEmail = (email: string) => {
    setCcEmails(ccEmails.filter((e) => e !== email))
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Contact Information</CardTitle>
        <CardDescription>How we can reach you about this ticket</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="email">
            Email <span className="text-red-500">*</span>
          </Label>
          <div className="flex items-center gap-2">
            <MailIcon className="h-4 w-4 text-muted-foreground" />
            <Input
              id="email"
              type="email"
              placeholder="your@email.com"
              required
              pattern="[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}"
              title="请输入有效的电子邮箱地址 (例如: name@example.com)"
              className="peer"
            />
          </div>
          <p className="mt-1 text-xs text-red-500 invisible peer-invalid:visible">请输入有效的电子邮箱格式</p>
        </div>

        <div className="space-y-2">
          <Label htmlFor="cc-email">CC Emails</Label>
          <div className="flex gap-2">
            <Input
              id="cc-email"
              type="email"
              placeholder="colleague@email.com"
              value={newCcEmail}
              onChange={(e) => setNewCcEmail(e.target.value)}
            />
            <Button type="button" size="sm" onClick={addCcEmail}>
              Add
            </Button>
          </div>
          {ccEmails.length > 0 && (
            <div className="flex flex-wrap gap-1 mt-2">
              {ccEmails.map((email) => (
                <Badge key={email} variant="secondary" className="flex items-center gap-1">
                  {email}
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-4 w-4 p-0 text-muted-foreground hover:text-destructive"
                    onClick={() => removeCcEmail(email)}
                  >
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      width="12"
                      height="12"
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
                </Badge>
              ))}
            </div>
          )}
        </div>

        <div className="space-y-2">
          <Label htmlFor="phone">Phone Number</Label>
          <div className="flex items-center gap-2">
            <PhoneIcon className="h-4 w-4 text-muted-foreground" />
            <Input id="phone" type="tel" placeholder="+1 (555) 123-4567" />
          </div>
        </div>

        <div className="space-y-2">
          <Label>Contact Time Preference</Label>
          <RadioGroup value={contactTime} onValueChange={setContactTime} className="space-y-2">
            <div className="flex items-center space-x-2">
              <RadioGroupItem value="anytime" id="anytime" />
              <Label htmlFor="anytime" className="font-normal">
                Any time
              </Label>
            </div>
            <div className="flex items-center space-x-2">
              <RadioGroupItem value="specific" id="specific" />
              <Label htmlFor="specific" className="font-normal">
                Specific time range
              </Label>
            </div>
          </RadioGroup>

          {contactTime === "specific" && (
            <div className="grid grid-cols-2 gap-2 mt-2">
              <div>
                <Label htmlFor="start-time" className="text-xs">
                  Start Time
                </Label>
                <Input
                  id="start-time"
                  type="time"
                  value={specificStartTime}
                  onChange={(e) => setSpecificStartTime(e.target.value)}
                />
              </div>
              <div>
                <Label htmlFor="end-time" className="text-xs">
                  End Time
                </Label>
                <Input
                  id="end-time"
                  type="time"
                  value={specificEndTime}
                  onChange={(e) => setSpecificEndTime(e.target.value)}
                />
              </div>
            </div>
          )}
        </div>

        <div className="flex items-center space-x-2">
          <Switch id="notifications" defaultChecked />
          <Label htmlFor="notifications" className="font-normal">
            Send me ticket progress notifications
          </Label>
        </div>
      </CardContent>
    </Card>
  )
}
