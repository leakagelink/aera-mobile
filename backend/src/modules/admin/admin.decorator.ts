import { SetMetadata } from '@nestjs/common';

export const IS_ADMIN = 'arah:admin';

export const Admin = () => SetMetadata(IS_ADMIN, true);
