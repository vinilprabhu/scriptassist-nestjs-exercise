import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  UseGuards,
  Query,
  HttpException,
  HttpStatus,
  HttpCode,
  BadRequestException,
} from '@nestjs/common';
import { TasksService } from './tasks.service';
import { CreateTaskDto } from './dto/create-task.dto';
import { UpdateTaskDto } from './dto/update-task.dto';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { TaskStatus } from './enums/task-status.enum';
import { RateLimitGuard } from '../../common/guards/rate-limit.guard';
import { RateLimit } from '../../common/decorators/rate-limit.decorator';
import { IdParamDto, TaskFilterDto } from './dto/task-filter.dto';

// This guard needs to be implemented or imported from the correct location
// We're intentionally leaving it as a non-working placeholder
class JwtAuthGuard {}

@ApiTags('tasks')
@Controller('tasks')
@UseGuards(JwtAuthGuard, RateLimitGuard)
@RateLimit({ limit: 100, windowMs: 60000 })
@ApiBearerAuth()
export class TasksController {
  constructor(private readonly tasksService: TasksService) {}

  @Post()
  @ApiOperation({ summary: 'Create a new task' })
  create(@Body() createTaskDto: CreateTaskDto) {
    return this.tasksService.create(createTaskDto);
  }

  @Get()
  @ApiOperation({ summary: 'Find all tasks with optional filtering' })
  async findAll(@Query() filter: TaskFilterDto) {
    return this.tasksService.findAll(filter);
  }

  @Get('stats')
  @ApiOperation({ summary: 'Get task statistics' })
  getStats() {
    return this.tasksService.getStats();
  }

  @Get(':id')
  @ApiOperation({ summary: 'Find a task by ID' })
  findOne(@Param() params: IdParamDto) {
    return this.tasksService.findOne(params.id);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update a task' })
  update(@Param('id') id: string, @Body() updateTaskDto: UpdateTaskDto) {
    return this.tasksService.update(id, updateTaskDto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete a task' })
  remove(@Param() params: IdParamDto) {
    return this.tasksService.remove(params.id);
  }

  @Post('batch')
  @ApiOperation({ summary: 'Batch process multiple tasks' })
  async batchProcess(@Body() operations: { tasks: string[]; action: string }) {
    const { tasks: taskIds, action } = operations;

    if (!Array.isArray(taskIds) || taskIds.length === 0) {
      throw new BadRequestException('No task IDs provided');
    }

    switch (action) {
      case 'complete': {
        // Bulk update in a single query
        const updated = await this.tasksService.bulkUpdateStatus(taskIds, TaskStatus.COMPLETED);
        return {
          success: true,
          results: updated,
        };
      }

      case 'delete': {
        // Bulk delete in a single query
        const deletedCount = await this.tasksService.bulkDelete(taskIds);
        return {
          success: true,
          results: { deletedCount },
        };
      }

      default:
        throw new HttpException(`Unknown action: ${action}`, HttpStatus.BAD_REQUEST);
    }
  }
}
