import { createFileRoute } from '@tanstack/react-router'
import type React from "react"

import { useState, useEffect } from "react"
import { useParams } from '@tanstack/react-router'
import { SidebarInset, SidebarProvider } from "@tentix/ui/comp/ui/sidebar"
import { SiteHeader } from "@tentix/ui/comp/site-header"
import { UserTicketSidebar } from "@tentix/ui/comp/user/user-ticket-sidebar"
import { TicketInfoBox } from "@tentix/ui/comp/ticket-info-box"
import { MessageList } from "@tentix/ui/comp/tickets/message-list"
import { MessageInput } from "@tentix/ui/comp/tickets/message-input"
import { TicketDetailsSidebar } from "@tentix/ui/comp/tickets/ticket-details-sidebar"


const ticketData = {
  id: "1",
  title: "Broken AC in Conference Room",
  status: "In Progress",
  priority: "High",
  createdAt: "2024-04-01T09:30:00",
  category: "HVAC",
  assignedTo: "Eddie Lake",
  messages: [
    {
      id: "1",
      sender: {
        name: "John Doe",
        avatar: "/avatars/shadcn.jpg",
        role: "user",
      },
      content:
        "The air conditioning unit in the main conference room is not cooling properly. It's making a strange noise and the temperature is not going below 78°F.",
      timestamp: "2024-04-01T09:30:00",
      attachments: [],
      isLoading: false,
    },
    {
      id: "2",
      sender: {
        name: "Support Agent",
        avatar: "/avatars/shadcn.jpg",
        role: "staff",
      },
      content:
        "Thank you for reporting this issue. I'll assign a technician to look into it. Can you please provide more details about when you first noticed the problem?",
      timestamp: "2024-04-01T10:15:00",
      attachments: [],
      isLoading: false,
    },
    {
      id: "3",
      sender: {
        name: "John Doe",
        avatar: "/avatars/shadcn.jpg",
        role: "user",
      },
      content:
        "I first noticed it yesterday afternoon during a meeting. The room was uncomfortably warm despite the AC being set to 68°F.",
      timestamp: "2024-04-01T10:30:00",
      attachments: [],
      isLoading: false,
    },
    {
      id: "4",
      sender: {
        name: "Support Agent",
        avatar: "/avatars/shadcn.jpg",
        role: "staff",
      },
      content:
        "I've assigned Eddie Lake to your ticket. He'll be visiting the conference room today between 2-4 PM. Will someone be available to provide access?",
      timestamp: "2024-04-01T11:00:00",
      attachments: [],
      isLoading: false,
    },
  ],
  expectedResolution: "2024-04-03T17:00:00",
  ticketDetails: {
    location: "Building A - Conference Room 3",
    reportedOn: "2024-04-01T09:30:00",
    lastUpdated: "2024-04-01T11:00:00",
    category: "HVAC",
    subcategory: "Air Conditioning",
  },
}


export const Route = createFileRoute('/user/tickets/$id')({
  component: RouteComponent,
})

function RouteComponent() {
  const ticketId = useParams({
    from: '/user/tickets/$id',
    select: (params) => params.id as string,
  })
  const [isLoading, setIsLoading] = useState(false)
  const [userIsTyping, setUserIsTyping] = useState(false)
  const [staffIsTyping, setStaffIsTyping] = useState(false)
  const [ticket, setTicket] = useState(ticketData)

  // Simulate loading state
  useEffect(() => {
    setIsLoading(true)
    const timer = setTimeout(() => {
      setIsLoading(false)
    }, 800)
    return () => clearTimeout(timer)
  }, [])

  // Format date for display
  const formatDate = (dateString: string) => {
    const date = new Date(dateString)
    const today = new Date()
    const yesterday = new Date(today)
    yesterday.setDate(yesterday.getDate() - 1)

    if (date.toDateString() === today.toDateString()) {
      return `Today at ${date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`
    } else if (date.toDateString() === yesterday.toDateString()) {
      return `Yesterday at ${date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`
    } else {
      return `${date.toLocaleDateString()} at ${date.toLocaleTimeString([], {
        hour: "2-digit",
        minute: "2-digit",
      })}`
    }
  }

  // Calculate time remaining until expected resolution
  const getTimeRemaining = () => {
    const now = new Date()
    const resolution = new Date(ticket.expectedResolution)
    const diffTime = resolution.getTime() - now.getTime()

    if (diffTime <= 0) return "Overdue"

    const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24))
    const diffHours = Math.floor((diffTime % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60))

    if (diffDays > 0) {
      return `${diffDays} day${diffDays > 1 ? "s" : ""} ${diffHours} hour${diffHours > 1 ? "s" : ""}`
    } else {
      return `${diffHours} hour${diffHours > 1 ? "s" : ""}`
    }
  }

  // Handle sending a new message
  const handleSendMessage = (content: string, files: File[]) => {
    // Show loading indicator only for the send button
    const tempMessage = {
      id: `temp-${Date.now()}`,
      sender: {
        name: "John Doe",
        avatar: "/avatars/shadcn.jpg",
        role: "user",
      },
      content: content,
      timestamp: new Date().toISOString(),
      attachments: files.map((file) => file.name),
      isLoading: true,
    }

    // Add temporary message immediately
    setTicket({
      ...ticket,
      messages: [...ticket.messages, tempMessage],
    })

    // Set user typing to false after sending
    setUserIsTyping(false)

    // Simulate sending message
    setTimeout(() => {
      // Replace temporary message with confirmed one
      setTicket((prevTicket) => {
        const updatedMessages = prevTicket.messages.map((msg) =>
          msg.id === tempMessage.id ? { ...msg, id: prevTicket.messages.length.toString(), isLoading: false } : msg,
        )
        return {
          ...prevTicket,
          messages: updatedMessages,
        }
      })

      // Simulate staff typing after user sends a message
      setTimeout(() => {
        setStaffIsTyping(true)

        // Simulate staff response after typing
        setTimeout(() => {
          setStaffIsTyping(false)

          // Add staff response
          const staffResponse = {
            id: (ticket.messages.length + 1).toString(),
            sender: {
              name: "Support Agent",
              avatar: "/avatars/shadcn.jpg",
              role: "staff",
            },
            content: "Thank you for the update. I'll make sure our technician is aware of this information.",
            timestamp: new Date().toISOString(),
            attachments: [],
            isLoading: false,
          }

          setTicket((prevTicket) => ({
            ...prevTicket,
            messages: [...prevTicket.messages, staffResponse],
          }))
        }, 3000)
      }, 1000)
    }, 500)
  }

  // Phone icon component
  function PhoneIcon(props: React.SVGProps<SVGSVGElement>) {
    return (
      <svg
        {...props}
        xmlns="http://www.w3.org/2000/svg"
        width="24"
        height="24"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z" />
      </svg>
    )
  }

  return <SidebarProvider>
      <UserTicketSidebar currentTicketId={ticketId} />
      <SidebarInset>
        <SiteHeader title={`Ticket #${ticketId}: ${ticket.title}`} />
        <div className="flex flex-1 flex-col">
          <div className="grid grid-cols-1 md:grid-cols-3 flex-1">
            <div className="md:col-span-2 flex flex-col h-[calc(100vh-48px)]">
              <TicketInfoBox ticket={ticket} role="user" />

              <MessageList
                messages={ticket.messages}
                isLoading={isLoading}
                userIsTyping={userIsTyping}
                staffIsTyping={staffIsTyping}
                ticketStatus={ticket.status}
                formatDate={formatDate}
              />

              <MessageInput onSendMessage={handleSendMessage} isLoading={isLoading} ticketStatus={ticket.status} />
            </div>

            <TicketDetailsSidebar
              ticket={ticket}
              formatDate={formatDate}
              getTimeRemaining={getTimeRemaining}
              PhoneIcon={PhoneIcon}
            />
          </div>
        </div>
      </SidebarInset>
    </SidebarProvider>
}
