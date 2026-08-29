export type CallType = "incoming" | "outgoing" | "missed";
export type CallMode = "voice" | "video";

export type Call = {
  id: string;
  user: {
    id: string;
    name: string;
    avatarUrl?: string;
  };
  type: CallType;
  mode: CallMode;
  timestamp: string;
  duration?: string;
};

export const calls: Call[] = [
  {
    id: "1",
    user: { id: "user-1", name: "Rahul" },
    type: "outgoing",
    mode: "voice",
    timestamp: "10:42 AM",
    duration: "12 min",
  },
  {
    id: "2",
    user: { id: "user-2", name: "Priya" },
    type: "missed",
    mode: "video",
    timestamp: "Yesterday",
  },
  {
    id: "3",
    user: { id: "user-3", name: "John" },
    type: "outgoing",
    mode: "voice",
    timestamp: "Yesterday",
    duration: "5 min",
  },
  {
    id: "4",
    user: { id: "user-4", name: "Alex" },
    type: "incoming",
    mode: "voice",
    timestamp: "Monday",
    duration: "8 min",
  },
];