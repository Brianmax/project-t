import { Controller, Get, Patch, Param, UseGuards } from '@nestjs/common';
import { UserService } from '../user/user.service';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';

@Controller('admin')
@UseGuards(RolesGuard)
@Roles('admin')
export class AdminController {
  constructor(private readonly userService: UserService) {}

  @Get('users')
  getUsers() {
    return this.userService.findAllNonAdmin();
  }

  @Patch('users/:id/approve')
  approveUser(@Param('id') id: string) {
    return this.userService.updateStatus(id, 'approved');
  }

  @Patch('users/:id/reject')
  rejectUser(@Param('id') id: string) {
    return this.userService.updateStatus(id, 'rejected');
  }
}
