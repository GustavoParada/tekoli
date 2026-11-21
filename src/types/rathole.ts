export type RatholeStatus = 'ocupado' | 'livre' | 'aliado' | 'em_raid' | 'reserva' | 'Builded' | (string & {});

export interface Rathole {
  id: string;
  numero: number;
  name: string;
  coords: {
    x: number;
    y: number;
  };
  owner: string;
  coOwner: string;
  tp: string;
  server: string;
  status: RatholeStatus;
  notes?: string;
  turretsCount?: number;
  updatedAt: string;
}

export interface DiscordEmbedField {
  name: string;
  value: string;
  inline?: boolean;
}

export interface DiscordEmbed {
  title: string;
  description: string;
  color: string; // hex like '#5865F2'
  fields: DiscordEmbedField[];
  footer?: {
    text: string;
    icon_url?: string;
  };
  thumbnail?: string;
  timestamp?: string;
}

export interface DiscordMessage {
  id: string;
  author: {
    name: string;
    avatar: string;
    isBot: boolean;
    tag?: string;
    role?: string;
    color?: string;
  };
  content: string;
  embed?: DiscordEmbed;
  timestamp: string;
  replyTo?: {
    author: string;
    content: string;
  };
}

export interface ProximityResult {
  rathole: Rathole;
  distance: number;
}
