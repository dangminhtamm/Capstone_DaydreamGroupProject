import { Body, Controller, Get, Post, Query, Request, Res, UseGuards } from '@nestjs/common';
import { Response } from 'express';
import { SearchService } from './search.service';
import { SearchQueryDto } from './dto/search-query.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

@Controller('search')
@UseGuards(JwtAuthGuard)
export class SearchController {
  constructor(private readonly searchService: SearchService) {}

  // -----------------------------------------------------------------------
  // Existing endpoints (unchanged) — returns full JSON response
  // -----------------------------------------------------------------------

  @Post()
  async ask(@Request() req, @Body() queryDto: SearchQueryDto) {
    return this.searchService.answerQuestion(req.user.userId, queryDto);
  }

  @Get()
  async find(@Request() req, @Query() queryDto: SearchQueryDto) {
    return this.searchService.answerQuestion(req.user.userId, queryDto);
  }

  // -----------------------------------------------------------------------
  // NEW: Streaming endpoint — Server-Sent Events (SSE)
  // -----------------------------------------------------------------------
  // Protocol:
  //   event: token     → data: "chunk of answer text"
  //   event: metadata  → data: { confidence, sources: [...] }
  //   event: done      → data: [DONE]
  //   event: error     → data: { message: "..." }
  // -----------------------------------------------------------------------

  @Post('stream')
  async askStream(
    @Request() req,
    @Body() queryDto: SearchQueryDto,
    @Res() res: Response,
  ) {
    // Set SSE headers
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no'); // Disable nginx buffering
    res.flushHeaders();

    try {
      const result = await this.searchService.answerQuestionStream(
        req.user.userId,
        queryDto,
      );

      // Stream answer tokens
      const reader = result.stream.getReader();

      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          // Send each text chunk as an SSE "token" event
          const escapedValue = JSON.stringify(value);
          res.write(`event: token\ndata: ${escapedValue}\n\n`);
        }
      } finally {
        reader.releaseLock();
      }

      // Send citations & confidence as a single metadata event
      const metadata = JSON.stringify({
        confidence: result.confidence,
        sources: result.citations,
      });
      res.write(`event: metadata\ndata: ${metadata}\n\n`);

      // Signal completion
      res.write(`event: done\ndata: [DONE]\n\n`);
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Stream failed';
      res.write(`event: error\ndata: ${JSON.stringify({ message })}\n\n`);
    } finally {
      res.end();
    }
  }
}

