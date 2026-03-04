import { Component, computed, inject } from '@angular/core';
import { StartupService } from '../../services/startup-service';
import { HttpErrorResponse } from '@angular/common/http';

type ErrorKind = 'tenant-not-found' | 'temporary';

function classifyError(err: unknown): ErrorKind {
  if (err instanceof HttpErrorResponse && err.status === 404) {
    return 'tenant-not-found';
  }
  return 'temporary';
}

@Component({
  selector: 'application-error',
  imports: [],
  templateUrl: './application-error.html',
  styleUrl: './application-error.scss',
})
export class ApplicationError {
  private readonly startup = inject(StartupService);

  protected readonly errorKind = computed<ErrorKind>(() =>
    classifyError(this.startup.error())
  );

  protected readonly isTenantNotFound = computed(
    () => this.errorKind() === 'tenant-not-found'
  );

  protected reload(): void {
    window.location.reload();
  }
}
