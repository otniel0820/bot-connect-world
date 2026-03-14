export interface MessageAttachment {
  type: 'image' | 'video' | 'audio' | 'file' | 'template' | string;
  payload: {
    url?: string;
    [key: string]: any;
  };
}

export interface MessagingEvent {
  sender: { id: string };
  recipient: { id: string };
  timestamp: number;
  message?: {
    mid: string;
    text?: string;
    attachments?: MessageAttachment[];
    is_echo?: boolean;
  };
  read?: { watermark: number };
  delivery?: { watermark: number; seq: number };
  postback?: { title: string; payload: string };
}

export interface WebhookEntry {
  id: string;
  time: number;
  messaging: MessagingEvent[];
}

export interface WebhookEventDto {
  object: string;
  entry: WebhookEntry[];
}
