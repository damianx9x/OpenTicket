import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ServeStaticModule } from '@nestjs/serve-static';
import { join } from 'path';
import { PrismaModule } from './prisma/prisma.module';
import { TicketsModule } from './tickets/tickets.module';
import { CommentsModule } from './comments/comments.module';
import { CostItemsModule } from './cost-items/cost-items.module';
import { AttachmentsModule } from './attachments/attachments.module';
import { DiagnosticsModule } from './diagnostics/diagnostics.module';
import { ConfigModule as AppConfigModule } from './config/config.module';
import { StorageModule } from './storage/storage.module';
import { SetupModule } from './setup/setup.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),
    // Serve static frontend files from ../frontend/out
    // This will serve the Next.js export as static HTML/CSS/JS
    ServeStaticModule.forRoot({
      rootPath: join(__dirname, '..', '..', 'frontend', 'out'),
      exclude: ['/api/(.*)', '/api/v1/(.*)', '/setup/(.*)'],
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
  ],
  controllers: [],
  providers: [],
})
export class AppModule {}