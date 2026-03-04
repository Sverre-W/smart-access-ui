import {
  AfterViewInit,
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  NgZone,
  OnDestroy,
  OnInit,
  ViewChild,
  computed,
  effect,
  inject,
  input,
  output,
  signal,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import * as fabric from 'fabric';
import { AccordionModule } from 'primeng/accordion';
import { ButtonModule } from 'primeng/button';
import { ConfirmDialogModule } from 'primeng/confirmdialog';
import { ConfirmationService } from 'primeng/api';
import { ContextMenu, ContextMenuModule } from 'primeng/contextmenu';
import { DialogModule } from 'primeng/dialog';
import { DividerModule } from 'primeng/divider';
import { InputNumberModule } from 'primeng/inputnumber';
import { InputTextModule } from 'primeng/inputtext';
import { SelectModule } from 'primeng/select';
import { SplitterModule } from 'primeng/splitter';
import { CardSize, EXTRA_PROPS, FALLBACK_FONTS, TemplateJson, mmToPx } from './card-editor.types';

// ── Pure helpers ──────────────────────────────────────────────────────────────

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

function applyTextboxResizeControls(obj: fabric.Textbox): void {
  obj.setControlsVisibility({
    mt: false,
    mb: false,
    ml: true,
    mr: true,
    bl: false,
    br: false,
    tl: false,
    tr: false,
    mtr: true,
  });
}

function buildContextMenuItems(
  obj: fabric.FabricObject & {
    fieldType?: string;
    dataField?: string;
    isBackground?: boolean;
    fontWeight?: string;
    fontStyle?: string;
    underline?: boolean;
    fontFamily?: string;
    fontSize?: number;
    fill?: string | fabric.Gradient<'linear' | 'radial'> | fabric.Pattern;
    textBackgroundColor?: string;
  },
  fonts: string[],
  handlers: {
    toggleBold: () => void;
    toggleItalic: () => void;
    toggleUnderline: () => void;
    setFont: (f: string) => void;
    setFontSize: () => void;
    setColor: () => void;
    setTextBgColor: () => void;
    renameField: () => void;
    setAsBackground: () => void;
    bringForward: () => void;
    bringToFront: () => void;
    sendBackward: () => void;
    sendToBack: () => void;
    deleteObj: () => void;
  }
) {
  const isText = obj.fieldType === 'text';
  const isPlaceholder = obj.fieldType === 'image-placeholder';
  const isImage = obj.fieldType === 'image-fixed';

  const items = [];

  if (isText) {
    items.push(
      { label: 'Bold', icon: 'pi pi-bold', command: handlers.toggleBold },
      { label: 'Italic', icon: 'pi pi-italic', command: handlers.toggleItalic },
      { label: 'Underline', icon: 'pi pi-underline', command: handlers.toggleUnderline },
      {
        label: 'Font',
        icon: 'pi pi-font',
        items: fonts.map(f => ({ label: f, command: () => handlers.setFont(f) })),
      },
      { label: 'Font Size…', icon: 'pi pi-text', command: handlers.setFontSize },
      { label: 'Text Color…', icon: 'pi pi-palette', command: handlers.setColor },
      { label: 'Text Background…', icon: 'pi pi-palette', command: handlers.setTextBgColor },
      { separator: true }
    );
  }

  if (isPlaceholder) {
    items.push(
      { label: 'Rename Field…', icon: 'pi pi-pencil', command: handlers.renameField },
      { separator: true }
    );
  }

  if (isImage) {
    items.push(
      { label: 'Set as Background', icon: 'pi pi-image', command: handlers.setAsBackground },
      { separator: true }
    );
  }

  items.push(
    { label: 'Bring Forward', icon: 'pi pi-angle-up', command: handlers.bringForward },
    { label: 'Bring to Front', icon: 'pi pi-angle-double-up', command: handlers.bringToFront },
    { label: 'Send Backward', icon: 'pi pi-angle-down', command: handlers.sendBackward },
    { label: 'Send to Back', icon: 'pi pi-angle-double-down', command: handlers.sendToBack },
    { separator: true },
    { label: 'Delete', icon: 'pi pi-trash', command: handlers.deleteObj }
  );

  return items;
}

// ── Component ─────────────────────────────────────────────────────────────────

@Component({
  selector: 'app-card-editor',
  changeDetection: ChangeDetectionStrategy.OnPush,
  providers: [ConfirmationService],
  imports: [
    FormsModule,
    AccordionModule,
    ButtonModule,
    ConfirmDialogModule,
    ContextMenuModule,
    DialogModule,
    DividerModule,
    InputNumberModule,
    InputTextModule,
    SelectModule,
    SplitterModule,
  ],
  templateUrl: './card-editor.html',
  styleUrl: './card-editor.scss',
})
export class CardEditor implements AfterViewInit, OnDestroy {
  @ViewChild('fabricCanvas', { static: false }) canvasRef!: ElementRef<HTMLCanvasElement>;
  @ViewChild('contentArea', { static: false }) contentAreaRef!: ElementRef<HTMLDivElement>;
  @ViewChild('fileInput', { static: false }) fileInputRef!: ElementRef<HTMLInputElement>;
  @ViewChild('imageInput', { static: false }) imageInputRef!: ElementRef<HTMLInputElement>;
  @ViewChild('contextMenu') contextMenuRef!: ContextMenu;

  private confirmationService = inject(ConfirmationService);
  private zone = inject(NgZone);

  // ── Inputs ────────────────────────────────────────────────────────────────

  readonly cardSizes = input.required<CardSize[]>();
  readonly fonts = input<string[]>([]);
  readonly displayScale = input<number | null>(null);
  /** Pre-load a saved template JSON string when the editor initialises. */
  readonly initialTemplate = input<string | null>(null);

  // ── Outputs ───────────────────────────────────────────────────────────────

  readonly save = output<string>();

  // ── Signals ───────────────────────────────────────────────────────────────

  readonly selectedCardSize = signal<CardSize | null>(null);
  readonly selectedObject = signal<(fabric.FabricObject & Record<string, unknown>) | null>(null);
  readonly canvasScale = signal(1);
  readonly contextMenuItems = signal<object[]>([]);

  // ── Dialog state ──────────────────────────────────────────────────────────

  readonly fontSizeDialogVisible = signal(false);
  readonly colorDialogVisible = signal(false);
  readonly textBgColorDialogVisible = signal(false);
  readonly placeholderNameDialogVisible = signal(false);

  readonly pendingFontSize = signal(24);
  readonly pendingColor = signal('#000000');
  readonly pendingTextBgColor = signal('#ffffff');
  readonly pendingFieldName = signal('');
  private pendingFieldNameCallback: ((name: string) => void) | null = null;

  // ── Computed ──────────────────────────────────────────────────────────────

  readonly resolvedFonts = computed<string[]>(() => {
    const f = this.fonts();
    return f?.length ? f : FALLBACK_FONTS;
  });

  readonly defaultFont = computed(() => this.resolvedFonts()[0]);

  /** Visual (post-scale) height of the card — used to size the shadow shell. */
  readonly canvasWrapperHeight = computed(
    () => (this.selectedCardSize() ? mmToPx(this.selectedCardSize()!.height) * this.canvasScale() : 0)
  );

  /** Visual (post-scale) width of the card — used to size the shadow shell. */
  readonly canvasWrapperWidth = computed(
    () => (this.selectedCardSize() ? mmToPx(this.selectedCardSize()!.width) * this.canvasScale() : 0)
  );

  /** Native (300-DPI) height — the inner clip div must be this size so scale() fits it correctly. */
  readonly canvasNativeHeight = computed(
    () => (this.selectedCardSize() ? mmToPx(this.selectedCardSize()!.height) : 0)
  );

  /** Native (300-DPI) width — the inner clip div must be this size so scale() fits it correctly. */
  readonly canvasNativeWidth = computed(
    () => (this.selectedCardSize() ? mmToPx(this.selectedCardSize()!.width) : 0)
  );

  readonly cardSizeOptions = computed(() =>
    this.cardSizes().map(cs => ({ label: `${cs.label} – ${cs.width}×${cs.height} mm (${cs.orientation})`, value: cs }))
  );

  // ── Private state ─────────────────────────────────────────────────────────

  private canvas: fabric.Canvas | null = null;
  private resizeObserver: ResizeObserver | null = null;
  private removeContextMenuListener: (() => void) | null = null;

  // ── Lifecycle ─────────────────────────────────────────────────────────────

  constructor() {
    // React to displayScale input changes
    effect(() => {
      const scale = this.displayScale();
      if (scale !== null) {
        this.canvasScale.set(scale);
      } else {
        this.recalcScale();
      }
    });

    // React to initialTemplate input changes — load whenever a non-null value
    // arrives, including after the host has resolved it asynchronously.
    effect(() => {
      const raw = this.initialTemplate();
      if (!raw || !this.canvas) return;
      try {
        const json = JSON.parse(raw) as TemplateJson;
        this.zone.run(() => this.loadTemplateFromJson(json));
      } catch {
        // Ignore malformed template
      }
    });
  }

  ngAfterViewInit(): void {
    this.patchFabricToObject();
    this.initCanvas();

    if (this.displayScale() === null) {
      this.resizeObserver = new ResizeObserver(() => {
        this.zone.run(() => this.recalcScale());
      });
      this.resizeObserver.observe(this.contentAreaRef.nativeElement);
    }
  }

  ngOnDestroy(): void {
    this.removeContextMenuListener?.();
    this.resizeObserver?.disconnect();
    this.canvas?.dispose();
  }

  // ── Canvas init ───────────────────────────────────────────────────────────

  private patchFabricToObject(): void {
    const originalToObject = fabric.FabricObject.prototype.toObject;
    fabric.FabricObject.prototype.toObject = function (additionalProps?: string[]) {
      return originalToObject.call(this, [...(EXTRA_PROPS as unknown as string[]), ...(additionalProps ?? [])]);
    };
  }

  private initCanvas(): void {
    const size = this.selectedCardSize();
    const width = size ? mmToPx(size.width) : 1012;
    const height = size ? mmToPx(size.height) : 638;

    this.canvas = new fabric.Canvas(this.canvasRef.nativeElement, {
      width,
      height,
      backgroundColor: '#ffffff',
      preserveObjectStacking: true,
    });

    this.bindCanvasEvents();
    this.attachContextMenuListener();
    // Only recalc scale when a size is already selected (e.g. when initialTemplate
    // is provided). If no size is selected yet the canvas wrapper is 0×0, so there
    // is nothing to scale until the user picks a size.
    if (size) {
      this.recalcScale();
    }
  }

  private reinitCanvas(size: CardSize): void {
    const width = mmToPx(size.width);
    const height = mmToPx(size.height);

    if (!this.canvas) return;

    this.canvas.clear();
    this.canvas.setWidth(width);
    this.canvas.setHeight(height);
    this.canvas.backgroundColor = '#ffffff';
    this.canvas.requestRenderAll();
    this.selectedObject.set(null);
    this.bindCanvasEvents();
    // Defer until Angular has flushed the new canvasNativeWidth/Height signal values
    // to the DOM. calcOffset() must also run here so Fabric recalculates its internal
    // canvas position after the wrapper has been repositioned — without it, object
    // placement and hit-testing use stale coordinates and Add Text / Add Image appear
    // to do nothing (objects land outside the visible canvas area).
    setTimeout(() => {
      this.canvas?.calcOffset();
      this.recalcScale();
    });
  }

  private bindCanvasEvents(): void {
    if (!this.canvas) return;
    const c = this.canvas;

    c.off('selection:created');
    c.off('selection:updated');
    c.off('selection:cleared');
    c.off('object:moving');
    c.off('object:scaling');
    c.off('object:modified');

    c.on('selection:created', () => this.zone.run(() => this.onSelectionChange()));
    c.on('selection:updated', () => this.zone.run(() => this.onSelectionChange()));
    c.on('selection:cleared', () =>
      this.zone.run(() => {
        this.selectedObject.set(null);
        this.contextMenuItems.set([]);
      })
    );

    c.on('object:moving', (e) => {
      const obj = e.target;
      if (!obj || !this.canvas) return;
      const bw = obj.getBoundingRect().width;
      const bh = obj.getBoundingRect().height;
      obj.set({
        left: clamp(obj.left, 0, (this.canvas.width ?? 0) - bw),
        top: clamp(obj.top, 0, (this.canvas.height ?? 0) - bh),
      });
    });

    c.on('object:scaling', (e) => {
      const obj = e.target;
      if (!obj || !this.canvas) return;
      const maxW = this.canvas.width ?? 0;
      const maxH = this.canvas.height ?? 0;
      if (obj.getScaledWidth() > maxW) obj.scaleX = maxW / obj.width;
      if (obj.getScaledHeight() > maxH) obj.scaleY = maxH / obj.height;
    });

    c.on('object:modified', (e) => {
      const obj = e.target as fabric.Textbox & Record<string, unknown>;
      if (obj instanceof fabric.Textbox) {
        obj.width = obj.width * obj.scaleX;
        obj.scaleX = 1;
        obj.initDimensions();
        c.requestRenderAll();
      }
    });
  }

  /** Attach a single native contextmenu listener to Fabric's upper canvas.
   *  This fires after the right-click gesture, so selection state is ready.
   *  We pick the object under the cursor, select it, then show the menu. */
  private attachContextMenuListener(): void {
    if (!this.canvas) return;

    // Remove any previously attached listener before re-attaching
    this.removeContextMenuListener?.();

    const upperCanvas = this.canvas.upperCanvasEl;
    const handler = (evt: MouseEvent) => {
      evt.preventDefault();
      this.zone.run(() => {
        if (!this.canvas) return;

        // Build a synthetic pointer event Fabric can use for hit-testing
        const syntheticEvent = new MouseEvent('mousemove', {
          clientX: evt.clientX,
          clientY: evt.clientY,
          bubbles: false,
        });

        // Hit-test: find the topmost object under the cursor
        const hit = this.canvas.findTarget(syntheticEvent as unknown as MouseEvent);

        if (hit) {
          this.canvas.setActiveObject(hit);
          this.canvas.requestRenderAll();
          this.selectedObject.set(hit as fabric.FabricObject & Record<string, unknown>);
          this.rebuildContextMenu(hit as fabric.FabricObject & Record<string, unknown>);
        } else {
          // Right-clicked on empty canvas area — keep current selection if any
          const active = this.canvas.getActiveObject() as (fabric.FabricObject & Record<string, unknown>) | null;
          if (active) {
            this.rebuildContextMenu(active);
          } else {
            this.contextMenuItems.set([]);
          }
        }

        this.contextMenuRef?.show(evt);
      });
    };

    upperCanvas.addEventListener('contextmenu', handler);
    this.removeContextMenuListener = () => upperCanvas.removeEventListener('contextmenu', handler);
  }

  private onSelectionChange(): void {
    if (!this.canvas) return;
    const active = this.canvas.getActiveObject() as (fabric.FabricObject & Record<string, unknown>) | null;
    this.selectedObject.set(active);
    if (active) {
      this.rebuildContextMenu(active);
    }
  }

  private rebuildContextMenu(obj: fabric.FabricObject & Record<string, unknown>): void {
    const items = buildContextMenuItems(
      obj as Parameters<typeof buildContextMenuItems>[0],
      this.resolvedFonts(),
      {
        toggleBold: () => this.toggleBold(),
        toggleItalic: () => this.toggleItalic(),
        toggleUnderline: () => this.toggleUnderline(),
        setFont: (f) => this.setFont(f),
        setFontSize: () => this.openFontSizeDialog(),
        setColor: () => this.openColorDialog(),
        setTextBgColor: () => this.openTextBgColorDialog(),
        renameField: () => this.openRenameFieldDialog(),
        setAsBackground: () => this.setAsBackground(),
        bringForward: () => this.bringForward(),
        bringToFront: () => this.bringToFront(),
        sendBackward: () => this.sendBackward(),
        sendToBack: () => this.sendToBack(),
        deleteObj: () => this.deleteSelected(),
      }
    );
    this.contextMenuItems.set(items);
  }

  private recalcScale(): void {
    if (this.displayScale() !== null || !this.canvas || !this.contentAreaRef?.nativeElement) return;
    // Subtract padding (1rem each side = 32px per axis) so the card never overflows the content area
    const PADDING = 32;
    const containerWidth = Math.max((this.contentAreaRef.nativeElement.clientWidth || 1) - PADDING, 1);
    const containerHeight = Math.max((this.contentAreaRef.nativeElement.clientHeight || 1) - PADDING, 1);
    const canvasWidth = this.canvas.width ?? 1;
    const canvasHeight = this.canvas.height ?? 1;
    const scaleByWidth = containerWidth / canvasWidth;
    const scaleByHeight = containerHeight / canvasHeight;
    // No upper-bound cap: always fill the available space while respecting aspect ratio
    this.canvasScale.set(Math.min(scaleByWidth, scaleByHeight));
  }

  // ── Two-way ngModel bridges for signals ───────────────────────────────────

  get pendingFieldNameModel(): string {
    return this.pendingFieldName();
  }
  set pendingFieldNameModel(v: string) {
    this.pendingFieldName.set(v);
  }

  get pendingFontSizeModel(): number {
    return this.pendingFontSize();
  }
  set pendingFontSizeModel(v: number) {
    this.pendingFontSize.set(v);
  }

  get pendingColorModel(): string {
    return this.pendingColor();
  }
  set pendingColorModel(v: string) {
    this.pendingColor.set(v);
  }

  get pendingTextBgColorModel(): string {
    return this.pendingTextBgColor();
  }
  set pendingTextBgColorModel(v: string) {
    this.pendingTextBgColor.set(v);
  }

  // ── Canvas panel ──────────────────────────────────────────────────────────

  get selectedCardSizeModel(): CardSize | null {
    return this.selectedCardSize();
  }

  set selectedCardSizeModel(size: CardSize | null) {
    if (!size) return;
    if (!this.canvas || this.canvas.getObjects().length === 0) {
      this.selectedCardSize.set(size);
      this.reinitCanvas(size);
      return;
    }
    this.confirmationService.confirm({
      message: 'Changing the card size will clear the canvas. Continue?',
      header: 'Clear Canvas?',
      icon: 'pi pi-exclamation-triangle',
      accept: () => {
        this.selectedCardSize.set(size);
        this.reinitCanvas(size);
      },
    });
  }

  clearCanvas(): void {
    if (!this.canvas || this.canvas.getObjects().length === 0) return;
    this.confirmationService.confirm({
      message: 'This will remove all objects from the canvas. Continue?',
      header: 'Clear Canvas?',
      icon: 'pi pi-exclamation-triangle',
      accept: () => {
        this.canvas?.clear();
        this.canvas!.backgroundColor = '#ffffff';
        this.canvas?.requestRenderAll();
        this.selectedObject.set(null);
      },
    });
  }

  // ── Template panel ────────────────────────────────────────────────────────

  triggerImport(): void {
    this.fileInputRef.nativeElement.value = '';
    this.fileInputRef.nativeElement.click();
  }

  onFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;

    const doLoad = () => {
      const reader = new FileReader();
      reader.onload = (e) => {
        this.zone.run(() => {
          try {
            const json = JSON.parse(e.target?.result as string) as TemplateJson;
            this.loadTemplateFromJson(json);
          } catch {
            // ignore malformed JSON
          }
        });
      };
      reader.readAsText(file);
    };

    if (this.canvas && this.canvas.getObjects().length > 0) {
      this.confirmationService.confirm({
        message: 'Importing a template will replace the current canvas. Continue?',
        header: 'Import Template?',
        icon: 'pi pi-exclamation-triangle',
        accept: doLoad,
      });
    } else {
      doLoad();
    }
  }

  onSave(): void {
    const json = this.serializeCanvas();
    this.save.emit(json);
  }

  onExport(): void {
    const json = this.serializeCanvas();
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'card-template.json';
    a.click();
    URL.revokeObjectURL(url);
  }

  // ── Add panel ─────────────────────────────────────────────────────────────

  addText(): void {
    if (!this.canvas) return;
    this.zone.run(() => {
      const textbox = new fabric.Textbox('Text', {
        left: 100,
        top: 100,
        fontSize: 24,
        fontFamily: this.defaultFont(),
        fill: '#000000',
      }) as fabric.Textbox & Record<string, unknown>;
      textbox['fieldType'] = 'text';
      applyTextboxResizeControls(textbox);
      this.canvas!.add(textbox);
      this.canvas!.setActiveObject(textbox);
      this.canvas!.requestRenderAll();
    });
  }

  triggerAddImage(): void {
    this.imageInputRef.nativeElement.value = '';
    this.imageInputRef.nativeElement.click();
  }

  onImageSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file || !this.canvas) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      const dataUrl = e.target?.result as string;
      const el = new Image();
      el.onload = () => {
        this.zone.run(() => {
          const img = new fabric.FabricImage(el, {
            left: 100,
            top: 100,
          }) as fabric.FabricImage & Record<string, unknown>;
          img['fieldType'] = 'image-fixed';
          this.canvas?.add(img);
          this.canvas?.setActiveObject(img);
          this.canvas?.requestRenderAll();
        });
      };
      el.src = dataUrl;
    };
    reader.readAsDataURL(file);
  }

  addImagePlaceholder(): void {
    this.pendingFieldName.set('');
    this.pendingFieldNameCallback = (name: string) => {
      if (!this.canvas) return;
      this.zone.run(() => {
        const rect = new fabric.Rect({
          left: 100,
          top: 100,
          width: 140,
          height: 160,
          fill: 'rgba(100,149,237,0.15)',
          stroke: '#6495ed',
          strokeDashArray: [4, 4],
          strokeWidth: 2,
          evented: true,
          selectable: true,
          hoverCursor: 'move',
        }) as fabric.Rect & Record<string, unknown>;
        rect['fieldType'] = 'image-placeholder';
        rect['dataField'] = name;
        this.canvas!.add(rect);
        this.canvas!.setActiveObject(rect);
        this.canvas!.requestRenderAll();
      });
    };
    this.placeholderNameDialogVisible.set(true);
  }

  confirmPlaceholderName(): void {
    const name = this.pendingFieldName().trim();
    if (!name) return;
    this.placeholderNameDialogVisible.set(false);
    this.pendingFieldNameCallback?.(name);
    this.pendingFieldNameCallback = null;
  }

  cancelPlaceholderName(): void {
    this.placeholderNameDialogVisible.set(false);
    this.pendingFieldNameCallback = null;
  }

  // ── Context menu actions ──────────────────────────────────────────────────

  private toggleBold(): void {
    const obj = this.selectedObject() as fabric.Textbox & Record<string, unknown> | null;
    if (!obj || !(obj instanceof fabric.Textbox)) return;
    obj.set('fontWeight', obj.fontWeight === 'bold' ? 'normal' : 'bold');
    this.canvas?.requestRenderAll();
  }

  private toggleItalic(): void {
    const obj = this.selectedObject() as fabric.Textbox & Record<string, unknown> | null;
    if (!obj || !(obj instanceof fabric.Textbox)) return;
    obj.set('fontStyle', obj.fontStyle === 'italic' ? 'normal' : 'italic');
    this.canvas?.requestRenderAll();
  }

  private toggleUnderline(): void {
    const obj = this.selectedObject() as fabric.Textbox & Record<string, unknown> | null;
    if (!obj || !(obj instanceof fabric.Textbox)) return;
    obj.set('underline', !obj.underline);
    this.canvas?.requestRenderAll();
  }

  private setFont(fontFamily: string): void {
    const obj = this.selectedObject() as fabric.Textbox | null;
    if (!obj || !(obj instanceof fabric.Textbox)) return;
    obj.set('fontFamily', fontFamily);
    this.canvas?.requestRenderAll();
  }

  private openFontSizeDialog(): void {
    const obj = this.selectedObject() as fabric.Textbox | null;
    if (!obj || !(obj instanceof fabric.Textbox)) return;
    this.pendingFontSize.set(obj.fontSize ?? 24);
    this.fontSizeDialogVisible.set(true);
  }

  confirmFontSize(): void {
    const obj = this.selectedObject() as fabric.Textbox | null;
    if (obj && obj instanceof fabric.Textbox) {
      obj.set('fontSize', this.pendingFontSize());
      obj.initDimensions();
      this.canvas?.requestRenderAll();
    }
    this.fontSizeDialogVisible.set(false);
  }

  private openColorDialog(): void {
    const obj = this.selectedObject() as fabric.Textbox | null;
    if (!obj) return;
    const fill = obj.fill;
    this.pendingColor.set(typeof fill === 'string' ? fill : '#000000');
    this.colorDialogVisible.set(true);
  }

  confirmColor(): void {
    const obj = this.selectedObject();
    if (obj) {
      obj.set('fill', this.pendingColor());
      this.canvas?.requestRenderAll();
    }
    this.colorDialogVisible.set(false);
  }

  private openTextBgColorDialog(): void {
    const obj = this.selectedObject() as fabric.Textbox & Record<string, unknown> | null;
    if (!obj || !(obj instanceof fabric.Textbox)) return;
    this.pendingTextBgColor.set((obj['textBackgroundColor'] as string) || '#ffffff');
    this.textBgColorDialogVisible.set(true);
  }

  confirmTextBgColor(): void {
    const obj = this.selectedObject() as fabric.Textbox & Record<string, unknown> | null;
    if (obj && obj instanceof fabric.Textbox) {
      obj.set('textBackgroundColor', this.pendingTextBgColor());
      this.canvas?.requestRenderAll();
    }
    this.textBgColorDialogVisible.set(false);
  }

  private openRenameFieldDialog(): void {
    const obj = this.selectedObject() as (fabric.FabricObject & Record<string, unknown>) | null;
    if (!obj || obj['fieldType'] !== 'image-placeholder') return;
    this.pendingFieldName.set((obj['dataField'] as string) ?? '');
    this.pendingFieldNameCallback = (name: string) => {
      obj['dataField'] = name;
      this.canvas?.requestRenderAll();
    };
    this.placeholderNameDialogVisible.set(true);
  }

  private setAsBackground(): void {
    const obj = this.selectedObject() as (fabric.FabricObject & Record<string, unknown>) | null;
    if (!obj || !this.canvas) return;
    this.canvas.sendObjectToBack(obj);
    obj.set({ selectable: false, evented: false });
    obj['isBackground'] = true;
    this.canvas.requestRenderAll();
  }

  private bringForward(): void {
    const obj = this.selectedObject();
    if (!obj || !this.canvas) return;
    this.canvas.bringObjectForward(obj);
    this.canvas.requestRenderAll();
  }

  private bringToFront(): void {
    const obj = this.selectedObject();
    if (!obj || !this.canvas) return;
    this.canvas.bringObjectToFront(obj);
    this.canvas.requestRenderAll();
  }

  private sendBackward(): void {
    const obj = this.selectedObject();
    if (!obj || !this.canvas) return;
    this.canvas.sendObjectBackwards(obj);
    this.canvas.requestRenderAll();
  }

  private sendToBack(): void {
    const obj = this.selectedObject();
    if (!obj || !this.canvas) return;
    this.canvas.sendObjectToBack(obj);
    this.canvas.requestRenderAll();
  }

  private deleteSelected(): void {
    const obj = this.selectedObject();
    if (!obj || !this.canvas) return;
    this.canvas.remove(obj);
    this.canvas.discardActiveObject();
    this.canvas.requestRenderAll();
    this.selectedObject.set(null);
    this.contextMenuItems.set([]);
  }

  // ── Import / Export ───────────────────────────────────────────────────────

  private async loadTemplateFromJson(json: TemplateJson): Promise<void> {
    if (!this.canvas) return;

    // Match against the host-provided cardSizes list by dimensions + orientation.
    // Tolerance of 0.5 mm handles minor floating-point variations (e.g. 53.98 vs 54).
    const TOLERANCE_MM = 0.5;
    const matched =
      this.cardSizes().find(
        cs =>
          Math.abs(cs.width - json.media.width) <= TOLERANCE_MM &&
          Math.abs(cs.height - json.media.height) <= TOLERANCE_MM &&
          cs.orientation === json.media.orientation
      ) ?? json.media;

    this.selectedCardSize.set(matched);
    const width = mmToPx(matched.width);
    const height = mmToPx(matched.height);

    this.canvas.clear();
    this.canvas.setWidth(width);
    this.canvas.setHeight(height);
    this.canvas.backgroundColor = '#ffffff';

    // Build a Fabric-compatible canvas JSON from the template's objects array
    await this.canvas.loadFromJSON({ version: '6.0.0', objects: json.objects });

    const objects = this.canvas.getObjects() as (fabric.FabricObject & Record<string, unknown>)[];
    for (const obj of objects) {
      if (obj['fieldType'] === 'text' && obj instanceof fabric.Textbox) {
        applyTextboxResizeControls(obj);
      }
      if (obj['fieldType'] === 'image-placeholder') {
        obj.set({ evented: true, selectable: true, hoverCursor: 'move' });
      }
      if (obj['isBackground'] === true) {
        obj.set({ selectable: false, evented: false });
      }
    }

    this.canvas.calcOffset();
    this.canvas.requestRenderAll();
    this.recalcScale();
    this.bindCanvasEvents();
  }

  private serializeCanvas(): string {
    const cardSize = this.selectedCardSize();
    if (!this.canvas || !cardSize) return '';

    const objects = this.canvas.getObjects() as (fabric.FabricObject & Record<string, unknown>)[];
    for (const obj of objects) {
      if (obj['fieldType'] !== 'image-fixed') {
        obj.width = obj.width * obj.scaleX;
        obj.height = obj.height * obj.scaleY;
        obj.scaleX = 1;
        obj.scaleY = 1;
      }
    }

    const fabricData = this.canvas.toObject([...(EXTRA_PROPS as unknown as string[])]);

    const template: TemplateJson = {
      version: 2,
      media: cardSize,
      dpi: 300,
      objects: fabricData.objects ?? [],
    };

    return JSON.stringify(template);
  }
}
