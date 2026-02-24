import { ComponentFixture, TestBed } from '@angular/core/testing';

import { ApplicationError } from './application-error';

describe('ApplicationError', () => {
  let component: ApplicationError;
  let fixture: ComponentFixture<ApplicationError>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ApplicationError]
    })
    .compileComponents();

    fixture = TestBed.createComponent(ApplicationError);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
