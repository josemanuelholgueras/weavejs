// SPDX-FileCopyrightText: 2025 2025 INDUSTRIA DE DISEÑO TEXTIL S.A. (INDITEX S.A.)
//
// SPDX-License-Identifier: Apache-2.0

import { type Logger } from 'pino';
import { Weave } from '@/weave';
import { v4 as uuidv4 } from 'uuid';
import {
  type WeaveElementInstance,
  type WeaveExportNodesOptions,
  WEAVE_EXPORT_BACKGROUND_COLOR,
  WEAVE_EXPORT_FORMATS,
} from '@inditextech/weave-types';
import Konva from 'konva';
import { getBoundingBox } from '@/utils';

export class WeaveExportManager {
  private instance: Weave;
  private logger: Logger;

  constructor(instance: Weave) {
    this.instance = instance;
    this.logger = this.instance.getChildLogger('export-manager');
    this.logger.debug('Export manager created');
  }

  exportNodes(
    nodes: WeaveElementInstance[],
    boundingNodes: (nodes: Konva.Node[]) => Konva.Node[],
    options: WeaveExportNodesOptions
  ): Promise<HTMLImageElement> {
    return new Promise((resolve) => {
      const {
        format = WEAVE_EXPORT_FORMATS.PNG,
        padding = 0,
        pixelRatio = 1,
        backgroundColor = WEAVE_EXPORT_BACKGROUND_COLOR,
      } = options;

      const stage = this.instance.getStage();
      const mainLayer = this.instance.getMainLayer();

      const originalScale = stage.scale();
      stage.scale({ x: 1, y: 1 });

      const realNodes: Konva.Node[] = nodes
        .map((node) => {
          if (node.getAttrs().nodeId) {
            return stage.findOne(`#${node.getAttrs().nodeId}`);
          }
          return node;
        })
        .filter((node) => typeof node !== 'undefined');

      if (mainLayer) {
        const bounds = getBoundingBox(stage, boundingNodes(realNodes));

        const scaleX = stage.scaleX();
        const scaleY = stage.scaleY();

        const unscaledBounds = {
          x: bounds.x / scaleX,
          y: bounds.y / scaleY,
          width: bounds.width / scaleX,
          height: bounds.height / scaleY,
        };

        const exportGroup = new Konva.Group();

        const background = new Konva.Rect({
          x: unscaledBounds.x - padding,
          y: unscaledBounds.y - padding,
          width: unscaledBounds.width + 2 * padding,
          height: unscaledBounds.height + 2 * padding,
          strokeWidth: 0,
          fill: backgroundColor,
        });

        exportGroup.add(background);

        for (const node of realNodes) {
          const clonedNode = node.clone({ id: uuidv4() });
          const absPos = node.getAbsolutePosition();
          clonedNode.absolutePosition({
            x: absPos.x / scaleX,
            y: absPos.y / scaleY,
          });
          exportGroup.add(clonedNode);
        }

        mainLayer.add(exportGroup);

        const backgroundRect = background.getClientRect();

        exportGroup.toImage({
          x: Math.round(backgroundRect.x),
          y: Math.round(backgroundRect.y),
          width: Math.round(backgroundRect.width),
          height: Math.round(backgroundRect.height),
          mimeType: format,
          pixelRatio,
          quality: options.quality ?? 1,
          callback: (img) => {
            exportGroup.destroy();
            stage.scale(originalScale);

            resolve(img);
          },
        });
      }
    });
  }

  imageToBase64(img: HTMLImageElement, mimeType: string): string {
    const canvas = document.createElement('canvas');
    canvas.width = img.naturalWidth;
    canvas.height = img.naturalHeight;

    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Could not get canvas context');

    ctx.drawImage(img, 0, 0);

    const URL = canvas.toDataURL(mimeType);

    canvas.remove();

    return URL;
  }
}
