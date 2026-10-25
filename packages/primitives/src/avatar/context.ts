import { createPrimitiveContext } from '../internal/index.ts';
import type { AvatarContext } from './types.ts';

export const avatarContext = createPrimitiveContext<AvatarContext>('Avatar.Root');
