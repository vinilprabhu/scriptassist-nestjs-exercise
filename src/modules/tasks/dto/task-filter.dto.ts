import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsInt, IsOptional, IsString, Min, IsUUID, IsDate } from 'class-validator';
import { Type } from 'class-transformer';
import { TaskStatus } from '../enums/task-status.enum';
import { TaskPriority } from '../enums/task-priority.enum';

export class TaskFilterDto {
  @ApiPropertyOptional({ enum: TaskStatus, description: 'Filter tasks by status' })
  @IsOptional()
  @IsEnum(TaskStatus)
  status?: TaskStatus;

  @ApiPropertyOptional({ enum: TaskPriority, description: 'Filter tasks by priority' })
  @IsOptional()
  @IsEnum(TaskPriority)
  priority?: TaskPriority;

  @ApiPropertyOptional({ description: 'Search tasks by title or description' })
  @IsOptional()
  @IsString()
  search?: string;

  @ApiPropertyOptional({ description: 'Filter tasks by user ID' })
  @IsOptional()
  @IsUUID()
  userId?: string;

  @ApiPropertyOptional({ description: 'Start date for filtering tasks (ISO 8601)' })
  @IsOptional()
  @IsDate()
  @Type(() => Date)
  startDate?: string;

  @ApiPropertyOptional({ description: 'End date for filtering tasks (ISO 8601)' })
  @IsOptional()
  @IsDate()
  @Type(() => Date)
  endDate?: string;

  @ApiPropertyOptional({ description: 'Page number for pagination', example: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number;

  @ApiPropertyOptional({ description: 'Number of results per page', example: 10 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  limit?: number;
}

export class IdParamDto {
  @ApiPropertyOptional({ description: 'ID of the task to find' })
  @IsUUID()
  id: string;
}
