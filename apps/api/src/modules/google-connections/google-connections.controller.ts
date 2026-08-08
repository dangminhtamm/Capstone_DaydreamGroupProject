import { Body, Controller, Post, Req, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { GoogleConnectionsService } from './google-connections.service';

@Controller('google')
@UseGuards(JwtAuthGuard)
export class GoogleConnectionsController {
  constructor(private readonly googleConnectionsService: GoogleConnectionsService) {}

  @Post('disconnect')
  disconnectGoogle(
    @Req() req,
    @Body() body: { deleteSyncedData?: boolean } = {},
  ) {
    return this.googleConnectionsService.disconnectGoogle(
      {
        supabaseId: req.user.userId,
        email: req.user.email,
      },
      {
        deleteSyncedData: body.deleteSyncedData === true,
      },
    );
  }
}
