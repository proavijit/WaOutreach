/**
 * Conversational Corpus for Peer-to-Peer WhatsApp Warm-up Engine
 *
 * Provides realistic, human-like dialog pairs to build organic sender reputation
 * and establish natural two-way conversation patterns between internal accounts.
 */

export const WARMUP_CONVERSATIONS = [
  {
    topic: 'quick_sync',
    starters: [
      'Hey, do you have 5 mins for a quick sync later?',
      'Quick question when you get a chance!',
      'Hey! Are you free for a brief call this afternoon?',
      'Let me know when you have a minute to chat.',
    ],
    replies: [
      'Sure! Wrapping up a task right now, free in 15 mins?',
      'Hey, yes! Does 3:30 work for you?',
      'Just saw this. Free now if you want to hop on.',
      'Hey! Sure thing, ping me whenever you are ready.',
    ],
  },
  {
    topic: 'document_review',
    starters: [
      'Did you get a chance to glance over that document?',
      'Hey, let me know your thoughts on the draft when you can.',
      'Sent you the updated version, take a look when free!',
      'Did that file come through okay on your end?',
    ],
    replies: [
      'Looking at it right now! Looks really solid.',
      'Just opened it up, will drop a few notes shortly.',
      'Yes, received! Reading through section 2 now.',
      'Looks good to me, no blockers on my side.',
    ],
  },
  {
    topic: 'casual_greeting',
    starters: [
      'Hey! How has your day been so far?',
      'Good morning! Hope you have a productive day ahead.',
      'Hey there, how is the week treating you?',
      'Afternoon! Hope all is going smoothly today.',
    ],
    replies: [
      'Pretty busy day but getting things done! How about you?',
      'Morning! Thanks, hope you have a great one too.',
      'Going well! Just tackling a few items on the backlog.',
      'Hey! Doing well, making good progress today.',
    ],
  },
  {
    topic: 'coffee_lunch',
    starters: [
      'Grabbing coffee in a bit, want anything?',
      'Hey, did you take lunch yet?',
      'Need an afternoon caffeine run haha, stepping out shortly.',
      'Taking a quick break, let me know if you need anything from the cafe.',
    ],
    replies: [
      'An iced latte would be amazing if you are already headed there!',
      'Just ate, but definitely need a coffee run soon.',
      'Haha enjoy! I am good for now, thanks for checking though.',
      'Grab me an espresso if you can, appreciate it!',
    ],
  },
  {
    topic: 'status_checkin',
    starters: [
      'Hey, all set for the client demo tomorrow?',
      'Checking in to see if we are still on track for Friday.',
      'Quick update on that ticket: just submitted the PR.',
      'Let me know if you need any help wrapping up that task.',
    ],
    replies: [
      'Yes, all prepped and slides are reviewed!',
      'On track! Just doing one last sanity check.',
      'Awesome, reviewing the PR right now.',
      'I think I am in good shape, will ping you if anything comes up!',
    ],
  },
  {
    topic: 'weekend_plans',
    starters: [
      'Almost Friday! Any fun plans for the weekend?',
      'Hey, are you taking off early tomorrow?',
      'Crazy how fast this week went by!',
      'Hope you have some downtime planned for this weekend!',
    ],
    replies: [
      'Definitely doing some relaxing and catching up on sleep haha.',
      'Heading outdoors if the weather holds up! What about you?',
      'I know right! Flew right by. Hope you have a great weekend too.',
      'Working on a personal project, should be fun!',
    ],
  },
];

/**
 * Returns a randomized conversation pair { starter, reply, topic }
 */
export function getRandomWarmupDialogue() {
  const category = WARMUP_CONVERSATIONS[Math.floor(Math.random() * WARMUP_CONVERSATIONS.length)];
  const starter = category.starters[Math.floor(Math.random() * category.starters.length)];
  const reply = category.replies[Math.floor(Math.random() * category.replies.length)];

  return {
    topic: category.topic,
    starter,
    reply,
  };
}

export default {
  WARMUP_CONVERSATIONS,
  getRandomWarmupDialogue,
};
