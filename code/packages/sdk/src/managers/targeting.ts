// SPDX-FileCopyrightText: 2025 2025 INDUSTRIA DE DISEÑO TEXTIL S.A. (INDITEX S.A.)
//
// SPDX-License-Identifier: Apache-2.0

import Konva from 'konva';
import { Weave } from '@/weave';
import { type Vector2d } from 'konva/lib/types';
import { type Logger } from 'pino';
import type {
  WeaveMousePointInfo,
  WeaveMousePointInfoSimple,
} from '@inditextech/weave-types';
import type { WeaveNodesSelectionPlugin } from '@/plugins/nodes-selection/nodes-selection';

export class WeaveTargetingManager {
  private instance: Weave;
  private logger: Logger;

  constructor(instance: Weave) {
    this.instance = instance;
    this.logger = this.instance.getChildLogger('targeting-manager');
    this.logger.debug('Targeting manager created');
  }

  resolveNode(node: Konva.Node): Konva.Node | undefined {
    const stage = this.instance.getStage();

    const nodeAttrs = node.getAttrs();

    // Is an internal node container, continue to its parent
    if (nodeAttrs.nodeId) {
      const parentNode = stage.findOne(`#${nodeAttrs.nodeId}`);

      if (!parentNode) {
        return undefined;
      }

      return this.resolveNode(parentNode);
    }
    // Is a node and not a layer
    if (nodeAttrs.nodeType && nodeAttrs.nodeType !== 'layer') {
      return node;
    }
    return undefined;
  }

  pointIntersectsElement(point?: Vector2d): Konva.Node | null {
    const stage = this.instance.getStage();
    const relativeMousePointer = point
      ? point
      : stage.getPointerPosition() ?? { x: 0, y: 0 };

    const mainLayer = this.instance.getMainLayer();

    if (!mainLayer) {
      return null;
    }

    const intersectedNode = mainLayer.getIntersection(relativeMousePointer);

    return intersectedNode;
  }

  pointIntersectsContainerElement(
    actualLayer?: Konva.Layer | Konva.Group,
    point?: Vector2d
  ): Konva.Node | undefined {
    const stage = this.instance.getStage();
    const relativeMousePointer = point
      ? point
      : stage.getPointerPosition() ?? { x: 0, y: 0 };

    const intersections = this.instance
      .getMainLayer()
      ?.getAllIntersections(relativeMousePointer);

    let intersectedNode: Konva.Node | undefined = undefined;
    if (intersections) {
      for (const node of intersections) {
        if (node.getAttrs().nodeId) {
          const parent = stage.findOne(`#${node.getAttrs().nodeId}`);
          if (!parent) {
            continue;
          }
          const resolvedNode = this.resolveNode(parent);
          if (
            resolvedNode &&
            resolvedNode.getAttrs().containerId &&
            resolvedNode.getAttrs().id !== actualLayer?.getAttrs().id
          ) {
            intersectedNode = parent;
          }
          continue;
        }
        if (
          node.getAttrs().containerId &&
          node.getAttrs().id !== actualLayer?.getAttrs().id
        ) {
          intersectedNode = node;
          continue;
        }
      }
    }

    return intersectedNode;
  }

  getMousePointer(point?: Vector2d): WeaveMousePointInfo {
    this.logger.debug({ point }, 'getMousePointer');
    const stage = this.instance.getStage();
    const mainLayer = this.instance.getMainLayer();

    let relativeMousePointer = point
      ? point
      : stage.getPointerPosition() ?? { x: 0, y: 0 };
    let measureContainer: Konva.Layer | Konva.Group | undefined = mainLayer;
    let container: Konva.Layer | Konva.Group | undefined = mainLayer;

    const nodesSelection =
      this.instance.getPlugin<WeaveNodesSelectionPlugin>('nodesSelection');

    if (nodesSelection) {
      nodesSelection.disable();
    }

    const intersectedNode = stage.getIntersection(relativeMousePointer);
    if (intersectedNode) {
      const node = this.instance.getInstanceRecursive(intersectedNode, [
        'group',
      ]);

      let nodeParent = null;
      if (node.getParent()) {
        nodeParent = this.instance.getInstanceRecursive(
          node.getParent() as Konva.Node,
          ['group']
        );
      }

      if (node && node instanceof Konva.Group && node.getAttrs().containerId) {
        measureContainer = (node as Konva.Group).findOne(
          `#${node.getAttrs().containerId}`
        ) as Konva.Group;
        container = node;
      }

      if (
        nodeParent &&
        nodeParent instanceof Konva.Group &&
        nodeParent.getAttrs().containerId
      ) {
        measureContainer = (nodeParent as Konva.Group).findOne(
          `#${nodeParent.getAttrs().containerId}`
        ) as Konva.Group;
        container = nodeParent;
      }
    }

    if (container?.getAttrs().nodeType !== 'layer') {
      relativeMousePointer =
        measureContainer?.getRelativePointerPosition() ?? relativeMousePointer;
    }

    if (container?.getAttrs().nodeType === 'layer') {
      relativeMousePointer = measureContainer?.getRelativePointerPosition() ?? {
        x: 0,
        y: 0,
      };
    }

    if (nodesSelection) {
      nodesSelection.enable();
    }

    return { mousePoint: relativeMousePointer, container, measureContainer };
  }

  getMousePointerRelativeToContainer(
    container: Konva.Group | Konva.Layer
  ): WeaveMousePointInfoSimple {
    const relativeMousePointer = container.getRelativePointerPosition() ?? {
      x: 0,
      y: 0,
    };

    return { mousePoint: relativeMousePointer, container };
  }
}
