import { create } from 'zustand'
import { persist } from 'zustand/middleware'

interface TicketFavoritesState {
  // Id list of starred tickets
  starredTickets: number[]
  // Id list of pinned tickets
  pinnedTickets: number[] 
  // Group expansion/collapse state
  expandedGroups: Record<string, boolean>

  // Actions
  toggleStarred: (ticketId: number) => void
  togglePinned: (ticketId: number) => void
  toggleGroup: (group: string) => void
  setExpandedGroups: (groups: Record<string, boolean>) => void
  isStarred: (ticketId: number) => boolean
  isPinned: (ticketId: number) => boolean
}

export const useTicketFavorites = create<TicketFavoritesState>()(
  persist(
    (set, get) => ({
      starredTickets: [],
      pinnedTickets: [],
      expandedGroups: {},

      toggleStarred: (ticketId: number) => 
        set((state) => {
          const isCurrentlyStarred = state.starredTickets.includes(ticketId)
          return {
            starredTickets: isCurrentlyStarred
              ? state.starredTickets.filter(id => id !== ticketId)
              : [...state.starredTickets, ticketId]
          }
        }),

      togglePinned: (ticketId: number) => 
        set((state) => {
          const isCurrentlyPinned = state.pinnedTickets.includes(ticketId)
          return {
            pinnedTickets: isCurrentlyPinned
              ? state.pinnedTickets.filter(id => id !== ticketId)
              : [...state.pinnedTickets, ticketId]
          }
        }),

      toggleGroup: (group: string) =>
        set((state) => ({
          expandedGroups: {
            ...state.expandedGroups,
            [group]: !state.expandedGroups[group]
          }
        })),

      setExpandedGroups: (groups: Record<string, boolean>) => 
        set({ expandedGroups: groups }),

      isStarred: (ticketId: number) => 
        get().starredTickets.includes(ticketId),

      isPinned: (ticketId: number) => 
        get().pinnedTickets.includes(ticketId),
    }),
    {
      name: 'ticket-favorites-storage', // Key name in localStorage
    }
  )
) 