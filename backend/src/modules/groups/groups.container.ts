import { PrismaGroupRepository } from './groups.repository.js';
import { GroupService } from './groups.service.js';

export const groupService = new GroupService(new PrismaGroupRepository());
