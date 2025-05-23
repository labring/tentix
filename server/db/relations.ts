import { relations } from 'drizzle-orm/relations';
import {
	tickets,
	chatMessages,
	messageReadStatus,
	tags,
	ticketHistory,
	ticketsTags,
	users,
  userSession,
  requirements,
  techniciansToTickets,
} from './schema.ts';

// Define relations for detailed tickets
export const ticketsRelations = relations(
	tickets,
	({ many, one }) => ({
		ticketHistory: many(ticketHistory), // ref to ticketHistoryRelations
		ticketsTags: many(ticketsTags), // ref to ticketsTagsRelations
    customer: one(users, {
      fields: [tickets.customerId],
      references: [users.id],
      relationName: 'customer',
    }),
    agent: one(users, {
      fields: [tickets.agentId],
      references: [users.id],
      relationName: 'agent',
    }),
    technicians: many(techniciansToTickets),
		messages: many(chatMessages), // ref to chatMessagesRelations.conversation
    requirements: many(requirements), // ref to requirementsRelations
	}),
);


export const ticketHistoryRelations = relations(ticketHistory, ({ one }) => ({
	ticketsRelations: one(tickets, {
		fields: [ticketHistory.ticketId],
		references: [tickets.id],
	}), // ref to ticketsRelations
	operator: one(users, {
		fields: [ticketHistory.operatorId],
		references: [users.id],
	}), // ref to usersRelations
}));

// Define relations for users
export const usersRelations = relations(users, ({ many }) => ({
	// ticket: many(ticketMembers), // ref to ticketMembersRelations
	messages: many(chatMessages), // ref to chatMessagesRelations
  readStatus: many(messageReadStatus), // ref to messageReadStatusRelations
  session: many(userSession), // ref to userSessionRelations
  ticketHistory: many(ticketHistory), // ref to ticketHistoryRelations
  ticketCustomer: many(tickets, {
    relationName: 'customer',
  }),
  ticketAgent: many(tickets, {
    relationName: 'agent',
  }),
  ticketTechnicians: many(techniciansToTickets),
}));


// export const ticketMembersRelations = relations(
// 	ticketMembers,
// 	({ one }) => ({
// 		ticket: one(ticket, {
// 			fields: [ticketMembers.ticketId],
// 			references: [ticket.id],
// 		}), // ref to ticketsRelations
// 		user: one(users, {
// 			fields: [ticketMembers.userId],
// 			references: [users.id],
// 		}), // ref to usersRelations
// 	}),
// );

export const techniciansToTicketsRelations = relations(techniciansToTickets, ({ one }) => ({
	user: one(users, {
		fields: [techniciansToTickets.userId],
		references: [users.id],
	}), // ref to usersRelations
	ticket: one(tickets, {
		fields: [techniciansToTickets.ticketId],
		references: [tickets.id],
	}), // ref to ticketsRelations
}));

export const chatMessagesRelations = relations(
	chatMessages,
	({ one, many }) => ({
		sender: one(users, {
			fields: [chatMessages.senderId],
			references: [users.id],
		}), // ref to usersRelations
		ticket: one(tickets, {
			fields: [chatMessages.ticketId],
			references: [tickets.id],
		}), // ref to ticketsRelations
		readStatus: many(messageReadStatus),
	}),
);

export const messageReadStatusRelations = relations(
	messageReadStatus,
	({ one }) => ({
		message: one(chatMessages, {
			fields: [messageReadStatus.messageId],
			references: [chatMessages.id],
		}), // ref to chatMessagesRelations
		user: one(users, {
			fields: [messageReadStatus.userId],
			references: [users.id],
		}), // ref to usersRelations
	}),
);

export const ticketsTagsRelations = relations(ticketsTags, ({ one }) => ({
	tag: one(tags, {
		fields: [ticketsTags.tagId],
		references: [tags.id],
	}), // ref to tagRelations
	ticket: one(tickets, {
		fields: [ticketsTags.ticketId],
		references: [tickets.id],
	}), // ref to ticketsRelations
}));

export const tagsRelations = relations(tags, ({ many }) => ({
	tickets: many(ticketsTags), // ref to ticketsTagsRelations
}));

export const userSessionRelations = relations(userSession, ({ one }) => ({
	user: one(users, {
		fields: [userSession.userId],
		references: [users.id],
	}), // ref to usersRelations
}));

export const requirementsRelations = relations(requirements, ({ one }) => ({
	relatedTicket: one(tickets, {
		fields: [requirements.relatedTicket],
		references: [tickets.id],
	}), // ref to ticketsRelations
}));
