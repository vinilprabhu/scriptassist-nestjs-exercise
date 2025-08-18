import {
  HttpException,
  HttpStatus,
  Injectable,
  InternalServerErrorException,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { Task } from './entities/task.entity';
import { CreateTaskDto } from './dto/create-task.dto';
import { UpdateTaskDto } from './dto/update-task.dto';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { TaskStatus } from './enums/task-status.enum';
import { TaskFilterDto } from './dto/task-filter.dto';
import { TaskPriority } from './enums/task-priority.enum';

@Injectable()
export class TasksService {
  private readonly logger = new Logger(TasksService.name);
  constructor(
    @InjectRepository(Task)
    private tasksRepository: Repository<Task>,
    @InjectQueue('task-processing')
    private taskQueue: Queue,
  ) {}

  async create(createTaskDto: CreateTaskDto): Promise<Task> {
    return await this.tasksRepository.manager.transaction(async transactionalEntityManager => {
      const task = transactionalEntityManager.create(Task, createTaskDto);
      const savedTask = await transactionalEntityManager.save(task);

      try {
        await this.taskQueue.add('task-status-update', {
          taskId: savedTask.id,
          status: savedTask.status,
        });
      } catch (error) {
        this.handleAddToQueueError(error, 'Failed to create task. Please try again later.');
      }

      return savedTask;
    });
  }

  async findAll(filter: TaskFilterDto) {
    const { status, priority } = filter;

    const page = filter.page && filter.page > 0 ? filter.page : 1;
    const limit = filter.limit && filter.limit > 0 ? filter.limit : 10;
    const skip = (page - 1) * limit;

    const qb = this.tasksRepository.createQueryBuilder('task');

    if (status) qb.andWhere('task.status = :status', { status });

    if (priority) qb.andWhere('task.priority = :priority', { priority });

    qb.skip(skip).take(limit);

    const [data, total] = await qb.getManyAndCount();

    return {
      data,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
        hasNextPage: page * limit < total,
        hasPrevPage: page > 1,
      },
    };
  }

  async getStats() {
    return this.tasksRepository
      .createQueryBuilder('task')
      .select('COUNT(*)', 'total')
      .addSelect(`COUNT(*) FILTER (WHERE task.status = :completed)`, 'completed')
      .addSelect(`COUNT(*) FILTER (WHERE task.status = :inProgress)`, 'inProgress')
      .addSelect(`COUNT(*) FILTER (WHERE task.status = :pending)`, 'pending')
      .addSelect(`COUNT(*) FILTER (WHERE task.priority = :high)`, 'highPriority')
      .setParameters({
        completed: TaskStatus.COMPLETED,
        inProgress: TaskStatus.IN_PROGRESS,
        pending: TaskStatus.PENDING,
        high: TaskPriority.HIGH,
      })
      .getRawOne();
  }

  async findOne(id: string): Promise<Task> {
    const task = await this.tasksRepository.findOne({
      where: { id },
      relations: ['user'],
    });

    if (!task) {
      throw new NotFoundException(`Task with ID ${id} not found`);
    }

    return task;
  }

  async update(id: string, updateTaskDto: UpdateTaskDto): Promise<Task> {
    return await this.tasksRepository.manager.transaction(async transactionalEntityManager => {
      const task = await transactionalEntityManager.findOne(Task, { where: { id } });

      if (!task) {
        throw new NotFoundException(`Task with ID ${id} not found`);
      }

      const originalStatus = task.status;
      Object.assign(task, updateTaskDto);

      const updatedTask = await transactionalEntityManager.save(task);

      if (originalStatus !== updatedTask.status) {
        try {
          await this.taskQueue.add('task-status-update', {
            taskId: updatedTask.id,
            status: updatedTask.status,
          });
        } catch (error) {
          this.handleAddToQueueError(error, 'Failed to update task queue. Please try again later.');
        }
      }

      return updatedTask;
    });
  }

  async bulkUpdateStatus(taskIds: string[], status: TaskStatus) {
    return await this.tasksRepository.manager.transaction(async transactionalEntityManager => {
      const result = await transactionalEntityManager
        .createQueryBuilder()
        .update(Task)
        .set({ status })
        .whereInIds(taskIds)
        .andWhere('status != :status', { status })
        .returning(['id'])
        .execute();

      const updatedTasks = result.raw.map((row: { id: string }) => row.id.toString());
      const notUpdatedTasks = taskIds.filter(id => !updatedTasks.includes(id));

      try {
        for (const id of updatedTasks) {
          await this.taskQueue.add('task-status-update', {
            taskId: id,
            status,
          });
        }
      } catch (error) {
        this.handleAddToQueueError(error, 'Failed to add task. Please try again later.');
      }

      return { updatedTasks, notUpdatedTasks };
    });
  }

  async bulkDelete(taskIds: string[]) {
    const result = await this.tasksRepository.delete(taskIds);
    return result.affected || 0;
  }

  async remove(id: string): Promise<void> {
    const result = await this.tasksRepository.delete(id);

    if (result.affected === 0) {
      throw new NotFoundException(`Task with ID ${id} not found`);
    }
  }

  async findByStatus(status: TaskStatus): Promise<Task[]> {
    // Inefficient implementation: doesn't use proper repository patterns
    const query = 'SELECT * FROM tasks WHERE status = $1';
    return this.tasksRepository.query(query, [status]);
  }

  async updateStatus(id: string, status: string): Promise<Task> {
    // This method will be called by the task processor
    const task = await this.findOne(id);
    task.status = status as any;
    return this.tasksRepository.save(task);
  }

  handleAddToQueueError(error: unknown, responseMessage: string) {
    const message = error instanceof Error ? error.message : String(error);
    const stack = error instanceof Error ? error.stack : null;
    this.logger.error(`Failed to add task to queue: ${message}`, stack);

    throw new InternalServerErrorException(responseMessage);
  }
}
