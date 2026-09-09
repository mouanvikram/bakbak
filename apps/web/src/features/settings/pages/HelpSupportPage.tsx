import { ChevronDown, Mail } from "lucide-react";

const FAQS: { q: string; a: string }[] = [
  {
    q: "How do I start a conversation?",
    a: "Open Friends, send a request, and once it's accepted you can message that person from their card or the New Chat menu. For a group, use Create Group in the chat list's overflow menu and pick at least two friends.",
  },
  {
    q: "How do attachments work?",
    a: "Use the paperclip in the composer to pick an image, video, audio clip or document — each file is sent as its own message and you can add a caption to the first one. Images and videos preview inline; other files show as a download link. You can turn inline previews off in Settings → Chat Settings.",
  },
  {
    q: "Enter sends my message before I'm done — can I change that?",
    a: 'Yes. In Settings → Chat Settings turn off "Enter to send". Enter then adds a new line and you send with Ctrl+Enter (⌘+Enter on Mac) or the send button.',
  },
  {
    q: "What does two-factor authentication do?",
    a: "With 2FA on, every sign-in asks for a 6-digit code emailed to you after your password is accepted. Turn it on in Settings → Security & Privacy — you'll confirm a code first so we know the address works.",
  },
  {
    q: "I'm signed in on a device I don't recognise.",
    a: 'Go to Settings → Devices to see every active session. Use "Log out" on the one you don\'t recognise, or "Log out other sessions" to end everything except the device you\'re on, then change your password.',
  },
  {
    q: "Can I edit or delete a message I sent?",
    a: "Right-click (or long-press) your own message for Edit and Delete. Deleting removes it for everyone in the chat.",
  },
  {
    q: "What happens when I delete my account?",
    a: "Everything goes — profile, messages, chats, friends and uploads — and it can't be undone. You'll need to type delete:<your username>, confirm your password (twice: once to send a code, once to delete), and re-enter any emailed verification code if you have two-factor authentication on. You can still undo the delete within 30 days via the email we send you.",
  },
  {
    q: "Why aren't I getting notifications?",
    a: "Push and email notifications aren't built yet. The toggles in Settings → Notifications are saved for when they land, but for now BakBak only notifies you while the app is open.",
  },
];

export function HelpSupportPage() {
  return (
    <div className="flex h-full w-full flex-col gap-6 overflow-y-auto p-6">
      <div>
        <h1 className="text-2xl font-semibold text-gray-900">Help & Support</h1>
        <p className="text-sm text-gray-500">
          Answers to common questions, and how to reach the team
        </p>
      </div>

      <div className="flex flex-col gap-2">
        <h2 className="text-lg font-semibold text-gray-900">
          Frequently asked questions
        </h2>
        {FAQS.map(({ q, a }) => (
          <details
            key={q}
            className="group rounded-lg border border-gray-200 p-4 [&_summary::-webkit-details-marker]:hidden"
          >
            <summary className="flex cursor-pointer items-center justify-between gap-4 font-medium text-gray-900">
              {q}
              <ChevronDown className="size-4 shrink-0 text-gray-400 transition-transform group-open:rotate-180" />
            </summary>
            <p className="mt-3 text-sm leading-relaxed text-gray-600">{a}</p>
          </details>
        ))}
      </div>

      <div className="flex flex-col gap-3 border-t border-gray-100 pt-6">
        <h2 className="text-lg font-semibold text-gray-900">Still stuck?</h2>
        <p className="text-sm text-gray-500">
          BakBak is an in-development project. If something's broken or you have
          an idea, send a note with your username and what you were doing — it
          goes straight to the maintainer.
        </p>
        <a
          href="mailto:support@bakbak.chat?subject=BakBak%20support"
          className="flex h-11 w-fit items-center gap-2 rounded-lg border border-gray-200 bg-white px-5 text-sm font-semibold text-gray-800 transition hover:bg-gray-50"
        >
          <Mail className="size-4" />
          Email support
        </a>
      </div>
    </div>
  );
}
