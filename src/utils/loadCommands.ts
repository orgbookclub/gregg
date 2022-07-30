import { readdir, stat } from 'fs/promises';
import { join } from 'path';
import { Bot } from '../interfaces/Bot';
import { Command } from '../interfaces/Command';

const OUT_DIR = 'dist';
export const loadCommands = async (bot: Bot): Promise<Command[]> => {
  try {
    const commands: Command[] = [];
    const files = await readdir(
      join(process.cwd(), OUT_DIR, 'commands'),
      'utf-8',
    );
    for (const file of files) {
      const status = await stat(join(process.cwd(), OUT_DIR, 'commands', file));
      if (status.isDirectory()) {
        continue;
      }
      const name = file.split('.')[0];
      const mod = await import(join(process.cwd(), OUT_DIR, 'commands', file));
      commands.push(mod[name] as Command);
    }
    return commands;
  } catch (err) {
    return [];
  }
};
