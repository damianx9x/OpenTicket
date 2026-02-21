import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ServeStaticModule } from '@nestjs/serve-static';
import { join } from 'path';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { PrismaModule } from './prisma/prisma.module';
import { TicketsModule } from './tickets/tickets.module';
import { CommentsModule } from './comments/comments.module';
import { CostItemsModule } from './cost-items/cost-items.module';
import { AttachmentsModule } from './attachments/attachments.module';
import { DiagnosticsModule } from './diagnostics/diagnostics.module';
import { ConfigModule as AppConfigModule } from './config/config.module';
import { StorageModule } from './storage/storage.module';
import { SetupModule } from './setup/setup.module';
import { QrcodeModule } from './qrcode/qrcode.module';
import { ProvisionModule } from './provision/provision.module';
import { AuthModule } from './auth/auth.module';
import { UsersModule } from './users/users.module';
import { SettingsModule } from './settings/settings.module';
import { StatisticsModule } from './statistics/statistics.module';
import { BackupModule } from './backup/backup.module';
import { NotificationsModule } from './notifications/notifications.module';
import { RemindersModule } from './reminders/reminders.module';
import { DemoModule } from './demo/demo.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),
    // Serve static frontend files from ../frontend/out
    // This will serve the Next.js export as static HTML/CSS/JS
    ServeStaticModule.forRoot({
      rootPath: join(__dirname, '..', '..', 'frontend', 'out'),
      serveStaticOptions: {
        // Map extension-less routes like /setup -> /setup.html and /dashboard -> /dashboard.html.
        extensions: ['html'],
        // Avoid stale frontend cache (Safari is sensitive here in local/offline mode).
        setHeaders: (res) => {
          res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
          res.setHeader('Pragma', 'no-cache');
          res.setHeader('Expires', '0');
          res.setHeader('Surrogate-Control', 'no-store');
        },
      },
      exclude: ['/api/(.*)', '/api/v1/(.*)'],
    }),
    AppConfigModule,
    StorageModule,
    SetupModule,
    PrismaModule,
    TicketsModule,
    CommentsModule,
    CostItemsModule,
    AttachmentsModule,
    DiagnosticsModule,
    QrcodeModule,
    ProvisionModule,
    AuthModule,
    UsersModule,
    SettingsModule,
    StatisticsModule,
    BackupModule,
    NotificationsModule,
    RemindersModule,
    DemoModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
