/**
 * Centralized user-facing copy used across the bot. Group everything by intent
 * (errors, messages, labels, titles, placeholders) and add to the matching
 * sub-namespace below when adding a new feature, instead of inlining strings
 * at the call site.
 *
 * For parameterized copy (anything with `${...}`), add a function under
 * {@link templates} rather than a constant.
 */
export const errors = {
  // General
  SomethingWentWrongError: "Something went wrong! Please try again later.",
  SomethingWentWrongShortError: "Something went wrong!",
  BRLeaderRestrictionError:
    "Sorry, this command is restricted for BR Leaders use only!",
  StaffRestrictionError:
    "Sorry, this command is restricted for staff use only!",
  StaffRestrictionActionError:
    "Sorry, this action is restricted for staff use only!",
  GuildOnlyActionError: "This action only works inside a server.",
  GuildOnlyCommandError: "You can't use this outside a guild!",
  GuildNotConfiguredError: "This server is not configured.",
  NotInGuildError: "You are not in a guild!",
  // Books
  GoodreadsIssueError:
    "Unfortunately, due to Goodreads being Goodreads, I cannot complete your request at the moment 😔\nPlease try again later, or use Storygraph instead 😆",
  NoBooksFoundError: "No books found with that query!",
  NoQuotesFoundError: "No quotes found with that query!",
  // Events
  InvalidEventIdError:
    "Invalid event ID! Please try again with a valid event ID.",
  EventNotFoundError: "Event not found.",
  EventInfoFetchError: "Could not fetch event info.",
  EmbedUpdateError: "Something went wrong while updating the embed",
  AlreadyInterestedError:
    "You are already marked as an interested participant of this event!",
  NeverInterestedError:
    "You were never marked as an interested participant of this event!",
  InvalidChannelError: "Invalid channel!",
  InvalidParticipantTypeError: "Invalid participant type.",
  InvalidDateFormatError: "Invalid date format. Use YYYY-MM-DD.",
  EndDateBeforeStartError: "End date cannot be before start date.",
  InvalidStatusError: "Invalid status.",
  EditFieldUnsupportedError:
    "Sorry, editing this field is currently not supported :(",
  AnnouncePostError: "Could not post in the selected channel :(",
  AnnouncementChannelInvalidError:
    "Selected channel is not a valid announcement channel.",
  AnnounceConfiguredChannelInvalidError:
    "Configured announcement channel is not valid :(",
  AnnounceMustBeApprovedError:
    "Event must be in 'Approved' state! Announcements can only be created for Approved events",
  ThreadCreateError: "Could not create the thread.",
  ChannelNotForumError: "Selected channel is not a forum channel.",
  EventRequestStrayError: "You shouldn't be here! :o",
  EventCreateError: "Something went wrong while trying to create the event :(",
  EventFetchError: "Something went wrong while trying fetch the event :(",
  EventRequestPostError:
    "Unable to post event request in the configured channel. Please contact staff!",
  // QOTD
  QotdNotFoundError: "QOTD not found.",
  QotdUnavailableError: "This QOTD is no longer available to post.",
  NoQotdsAvailableError: "There are no available Qotds",
  QotdChannelNotFoundError:
    "Something went wrong while trying to log the question in the channel. Please contact staff",
  NoQotdForIdError: "No QOTD available with given ID!",
  NoQotdToPostError: "There are no available QOTDs to post!",
  // Sprints
  NotASprintParticipantError: "You were not a participant of this sprint!",
  NoOngoingSprintsError: "There are no ongoing sprints in this thread!",
  NoSprintToLeaveError: "There are no ongoing sprints to leave in this thread!",
  NoSprintToCancelError:
    "There are no active sprints to cancel in this thread!",
  SprintAlreadyActiveError:
    "There is already an active or scheduled sprint in this thread!",
  NoFinishedSprintError:
    "There are no finished sprints to log end counts in this thread!",
  NoSprintToJoinError:
    "There are no ongoing sprints to join in this thread!\nPlease start a sprint first to join it",
  // User
  NoEventsForUserError: "No events found, something went wrong! :(",
  UserStatsFetchError: "Could not fetch stats for that user.",
  // Bookmark
  BookmarkFailedError: "Bookmarking failed!",
  BookmarkDmsDisabledError:
    "Unable to bookmark! Please make sure you have settings configured to enable DMs",
  // Pagination
  ButtonsNotForYouError: "These buttons aren't for you!",
  MenuNotForYouError: "This menu isn't for you!",
};

export const messages = {
  // General
  Pong: "Pong!",
  EchoSuccess: "Echo successful!",
  // Bookmarks
  BookmarkCreated: "Message has been bookmarked!",
  // Config
  GuildConfigUpdated: "Guild Config Updated!",
  // Events
  ParticipantJoined:
    "You have been marked as an interested participant for this event!",
  ParticipantLeft: "You are no longer a participant of this event",
  // QOTD
  QotdSuggestionSubmitted: "Your suggestion has been submitted!",
  QotdApproved: "Approved",
  QotdRejected: "Rejected",
};

export const labels = {
  // Generic actions
  Approve: "Approve",
  Reject: "Reject",
  Edit: "Edit",
  // Pagination
  Previous: "Previous",
  Next: "Next",
  // Event participation
  Join: "Join",
  Leave: "Leave",
  // Event lifecycle
  CreateThread: "Create Thread",
  Announce: "Announce",
  AddPoints: "Add Points",
  RemovePoints: "Remove Points",
};

export const titles = {
  EditEvent: "Edit Event",
  AnnounceEvent: "Announce Event",
  AddParticipants: "Add participants",
  QotdSuggestion: "QOTD Suggestion",
  ReaderRoleUpdate: "Reader Role Update",
  EventBroadcast: "Event Broadcast",
  MessageDelete: "Message Delete",
  GuildConfigUpdate: "Guild Config Update",
};

export const placeholders = {
  BookLinkPrompt: "What's the GR or SG link to the book?",
  BookLinkExample: "https://www.goodreads.com/book/show/xxxxyyy-zzzz",
  EventStartPrompt: "When do you want the event to start?",
  EventEndPrompt: "When do you want the event to end?",
  DatePlaceholder: "YYYY-MM-DD",
  RequestReasonPrompt: "Why are you requesting this book?",
  RequestReasonExample:
    "A short description of why other folks should join your event",
};

/**
 * Functions for parameterized user-facing copy. Prefer these over inline
 * template literals so the wording stays consistent across call sites.
 */
export const templates = {
  /** Generic "command failed to run" reply. */
  commandRunError: (commandName: string) =>
    `Something went wrong while trying to run command ${commandName}`,
  /** Generic "context command failed to run" reply. */
  contextCommandRunError: (commandName: string) =>
    `Something went wrong while trying to run context command ${commandName}`,
  /** Cooldown wait message. */
  cooldownWait: (commandName: string, relativeTime: string) =>
    `Please wait, you are on a cooldown for \`${commandName}\`. You can use it again ${relativeTime}.`,
  /** QOTD approve/reject ack. */
  qotdActionAck: (action: "Approved" | "Rejected", qotdId: string) =>
    `${action} QOTD \`${qotdId}\``,
  /** Reply when a user joins an event from the event-list embed. */
  eventListJoined: (eventId: string, bookTitle: string) =>
    `You have been marked as an interested participant of event with id \`${eventId}\` of \`${bookTitle}\`!`,
  /** Reply when a user leaves an event from the event-list embed. */
  eventListLeft: (eventId: string, bookTitle: string) =>
    `You have been removed as an interested participant of event with id \`${eventId}\` of \`${bookTitle}\`.`,
  /** State-restricted action gate. */
  mustBeInState: (state: string, action: string) =>
    `Event must be in '${state}' state to ${action}.`,
  /** Event status change ack. */
  eventStatusChanged: (eventId: string, status: string) =>
    `Event \`${eventId}\` marked as **${status}**.`,
  /** Event update ack. */
  eventUpdated: (eventId: string) => `Event \`${eventId}\` updated`,
  /** Event request submitted ack. */
  eventRequestSuccess: (bookTitle: string, eventId: string) =>
    `Event request for ${bookTitle} successful!\n Event ID: ${eventId}`,
  /** Invalid submission warning. */
  invalidSubmission: (message: string | undefined) =>
    `Invalid submission: ${message ?? ""}`,
  /** Slash-form announcement posted ack. */
  announcementPostedSlash: (
    eventId: string,
    url: string,
    statusMessage: string,
  ) => `Announcement posted for event ${eventId}: ${url} ${statusMessage}`,
  /** Modal-form announcement posted ack. */
  announcementPostedModal: (url: string, statusMessage: string) =>
    `Announcement posted: ${url}. ${statusMessage}`,
  /** Thread created ack. */
  threadCreated: (threadId: string, eventId: string) =>
    `Created <#${threadId}> for event \`${eventId}\`.`,
  /** No registered user found by id. */
  noRegisteredUser: (userId: string) =>
    `No user found! Please check if the user ID ${userId} is registered with the bot`,
  /** Bookmark created DM body. */
  bookmarkCreated: (timestamp: string, url: string) =>
    `Bookmark created: ${timestamp}\n${url}`,
  /** Add-participants ack. */
  participantsAdded: (
    count: number,
    eventId: string,
    participantType: string,
    points: number,
    usernames: string,
  ) =>
    `Added ${count} user(s) to event \`${eventId}\` as ${participantType} (${points} pts): ${usernames}`,
  /** Remove-participants ack. */
  participantsRemoved: (
    count: number,
    eventId: string,
    participantType: string,
    usernames: string,
    notListedSuffix: string,
  ) =>
    `Removed ${count} user(s) from event \`${eventId}\` as ${participantType}: ${usernames}${notListedSuffix}`,
  /** "(N selected user(s) were not on the list)" suffix. */
  participantsNotListedSuffix: (count: number) =>
    ` (${count} selected user(s) were not on the list)`,
  /** Invalid points value warning. */
  invalidPoints: (max: number) =>
    `Invalid points value. Please enter an integer between 0 and ${max}.`,
  /** Sprint start announcement. */
  sprintStartAnnouncement: (duration: number) =>
    `📚📚📚 **Sprint started!**  | Duration: ${duration} minutes 📚📚📚\nPlease use the \`/sprint join\` command to join the sprint`,
  /** Sprint finish announcement. */
  sprintFinishAnnouncement: (mentions: string, minutesToWait: number) =>
    `${mentions}\nSprint Finished! Please log your end count within the next ${minutesToWait} minutes using \`/sprint finish\``,
  /** Sprint end stats heading. */
  sprintEndHeading: () => "Congratulations Sprinters!\n**SPRINT STATS**",
  /** Sprint scheduled ack. */
  sprintScheduled: (duration: number, delay: number) =>
    `A Sprint of ${duration} minutes will start in ${delay} minute(s)!`,
  /** Sprint started ack. */
  sprintStarted: (duration: number) =>
    `Sprint started! ${duration} minutes to go ⏳`,
  /** Sprint finish count ack. */
  sprintFinishLogged: (count: number) =>
    `Successfully logged your end count as ${count}!`,
  /** Sprint left ack. */
  sprintLeft: (userId: string) => `<@${userId}> has left the sprint`,
  /** Sprint cancelled ack. */
  sprintCancelled: (userId: string) => `Sprint cancelled by <@${userId}>`,
  /** Sprint joined ack. */
  sprintJoined: (userId: string, startCount: number) =>
    `<@${userId}> has successfully joined sprint with starting count of ${startCount}!`,
  /** Modal submit timeout warning. */
  modalTimeout: (minutes: number) =>
    `Your request timed out! Please try again and submit the form within ${minutes} minutes.`,
  /** No events matched a search query. */
  noEventsForQuery: (query: string) => `No events found for "${query}".`,
  /** QOTD posted ack. */
  qotdPosted: (url: string, noteSuffix: string) =>
    `QOTD posted: ${url}${noteSuffix}`,
  /** No user found by Discord ID. */
  noUserForDiscordId: (id: string) => `No user found with user Id: ${id}`,
  /** Create-thread "first" gate. */
  createThreadFirst: () => "Create a thread first before announcing.",
};
