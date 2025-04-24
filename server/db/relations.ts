import { relations } from 'drizzle-orm/relations';
import {
	ticketSessionMembers,
	ticketSession,
	chatMessages,
	messageContentBlocks,
	messageReadStatus,
	tags,
	ticketHistory,
	ticketsTags,
	users,
  userSession,
} from './schema.js';

// Define relations for detailed tickets
export const ticketSessionRelations = relations(
	ticketSession,
	({ many }) => ({
		ticketHistory: many(ticketHistory), // ref to ticketHistoryRelations
		ticketsTags: many(ticketsTags), // ref to ticketsTagsRelations
    members: many(ticketSessionMembers), // ref to ticketSessionMembersRelations
		messages: many(chatMessages), // ref to chatMessagesRelations.conversation
	}),
);


export const ticketHistoryRelations = relations(ticketHistory, ({ one }) => ({
	ticketRelations: one(ticketSession, {
		fields: [ticketHistory.ticketId],
		references: [ticketSession.id],
	}), // ref to ticketSessionRelations
}));

// Define relations for users
export const usersRelations = relations(users, ({ many }) => ({
	ticketSession: many(ticketSessionMembers), // ref to ticketSessionMembersRelations
	messages: many(chatMessages), // ref to chatMessagesRelations
  readStatus: many(messageReadStatus), // ref to messageReadStatusRelations
  session: many(userSession), // ref to userSessionRelations
}));


export const ticketSessionMembersRelations = relations(
	ticketSessionMembers,
	({ one }) => ({
		ticket: one(ticketSession, {
			fields: [ticketSessionMembers.ticketId],
			references: [ticketSession.id],
		}), // ref to ticketSessionRelations
		user: one(users, {
			fields: [ticketSessionMembers.userId],
			references: [users.id],
		}), // ref to usersRelations
	}),
);

export const chatMessageRelations = relations(
	chatMessages,
	({ one, many }) => ({
		contentBlocks: many(messageContentBlocks), // ref to messageContentBlockRelations
		sender: one(users, {
			fields: [chatMessages.senderId],
			references: [users.id],
		}), // ref to usersRelations
		ticket: one(ticketSession, {
			fields: [chatMessages.ticketId],
			references: [ticketSession.id],
		}), // ref to ticketSessionRelations
	}),
);

export const messageContentBlockRelations = relations(
	messageContentBlocks,
	({ one }) => ({
		message: one(chatMessages, {
			fields: [messageContentBlocks.messageId],
			references: [chatMessages.id],
		}), // ref to chatMessagesRelations
	}),
);

export const chatMessagesRelations = relations(
	chatMessages,
	({ one, many }) => ({
		ticket: one(ticketSession, {
			fields: [chatMessages.ticketId],
			references: [ticketSession.id],
		}),
		sender: one(users, {
			fields: [chatMessages.senderId],
			references: [users.id],
		}),
		contentBlocks: many(messageContentBlocks),
		readStatus: many(messageReadStatus),
	}),
);

export const messageContentBlocksRelations = relations(
	messageContentBlocks,
	({ one }) => ({
		message: one(chatMessages, {
			fields: [messageContentBlocks.messageId],
			references: [chatMessages.id],
		}),
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
	ticket: one(ticketSession, {
		fields: [ticketsTags.ticketId],
		references: [ticketSession.id],
	}), // ref to ticketSessionRelations
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
