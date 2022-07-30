import { Client } from 'discord.js';
import { Command } from './Command';

export interface Bot extends Client {
  commands: Command[];
  configs: {
    token: string;
    clientId: string;
    homeGuildId: string;
  };
}
