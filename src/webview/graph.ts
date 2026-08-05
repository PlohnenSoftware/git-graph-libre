import type { GitCommitNode } from "@/backend/types";

const MUTED_GRAPH_COLOR = "oklch(60% 0 0)";
const MASK_VISIBLE_COLOR = "oklch(100% 0 0)";
const MASK_HIDDEN_COLOR = "oklch(0% 0 0)";
const NODE_RADIUS = 4;

interface UnavailablePoint {
  connectsTo: VertexOrNull;
  onBranch: Branch;
}
type VertexOrNull = Vertex | null;

class Branch {
  private readonly lines: Line[] = [];
  private readonly color: number;
  private end: number = 0;
  private numUncommitted: number = 0;

  constructor(color: number) {
    this.color = color;
  }

  public addLine(p1: Point, p2: Point, isCommitted: boolean, lockedFirst: boolean) {
    this.lines.push({ p1: p1, p2: p2, lockedFirst: lockedFirst });
    if (isCommitted) {
      if (p2.y < this.numUncommitted) this.numUncommitted = p2.y;
    } else {
      this.numUncommitted++;
    }
  }
  public getColor() {
    return this.color;
  }
  public getEnd() {
    return this.end;
  }
  public setEnd(end: number) {
    this.end = end;
  }
  public draw(svg: SVGElement, config: Config, expandAt: number) {
    const color = config.graphColors[this.color % config.graphColors.length];
    const lines = this.getPlacedLines(config, expandAt);
    this.simplifyStraightLines(lines);

    let curPath = "";
    let curColor = "";
    const d = config.grid.y * (config.graphStyle === "angular" ? 0.38 : 0.8);

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      if (curPath !== "" && i > 0 && line.isCommitted !== lines[i - 1].isCommitted) {
        this.drawPath(svg, curPath, curColor);
        curPath = "";
        curColor = "";
      }

      curPath = this.startPathIfNeeded(curPath, line, lines[i - 1]);
      if (curColor === "") curColor = line.isCommitted ? color : MUTED_GRAPH_COLOR;
      curPath = this.appendLineToPath(curPath, line, d, config.graphStyle);
    }

    this.drawPath(svg, curPath, curColor); // Draw the remaining path
  }
  private getPlacedLines(config: Config, expandAt: number) {
    const lines: PlacedLine[] = [];
    for (let i = 0; i < this.lines.length; i++) {
      lines.push(...this.getPlacedLineSegments(this.lines[i], i, config, expandAt));
    }
    return lines;
  }
  private getPlacedLineSegments(line: Line, index: number, config: Config, expandAt: number) {
    const x1 = line.p1.x * config.grid.x + config.grid.offsetX;
    const y1 = line.p1.y * config.grid.y + config.grid.offsetY;
    const x2 = line.p2.x * config.grid.x + config.grid.offsetX;
    const y2 = line.p2.y * config.grid.y + config.grid.offsetY;
    const isCommitted = index >= this.numUncommitted;

    if (expandAt <= -1) return [this.toPlacedLine(x1, y1, x2, y2, isCommitted, line.lockedFirst)];
    if (line.p1.y > expandAt) {
      return [
        this.toPlacedLine(
          x1,
          y1 + config.grid.expandY,
          x2,
          y2 + config.grid.expandY,
          isCommitted,
          line.lockedFirst
        )
      ];
    }
    if (line.p2.y <= expandAt) {
      return [this.toPlacedLine(x1, y1, x2, y2, isCommitted, line.lockedFirst)];
    }
    if (x1 === x2) {
      return [
        this.toPlacedLine(x1, y1, x2, y2 + config.grid.expandY, isCommitted, line.lockedFirst)
      ];
    }
    if (line.lockedFirst) {
      return [
        this.toPlacedLine(x1, y1, x2, y2, isCommitted, line.lockedFirst),
        this.toPlacedLine(
          x2,
          y1 + config.grid.y,
          x2,
          y2 + config.grid.expandY,
          isCommitted,
          line.lockedFirst
        )
      ];
    }

    const expandedY1 = y1 + config.grid.expandY;
    const expandedY2 = y2 + config.grid.expandY;
    return [
      this.toPlacedLine(
        x1,
        y1,
        x1,
        y2 - config.grid.y + config.grid.expandY,
        isCommitted,
        line.lockedFirst
      ),
      this.toPlacedLine(x1, expandedY1, x2, expandedY2, isCommitted, line.lockedFirst)
    ];
  }
  private toPlacedLine(
    x1: number,
    y1: number,
    x2: number,
    y2: number,
    isCommitted: boolean,
    lockedFirst: boolean
  ): PlacedLine {
    return {
      p1: { x: x1, y: y1 },
      p2: { x: x2, y: y2 },
      isCommitted,
      lockedFirst
    };
  }
  private simplifyStraightLines(lines: PlacedLine[]) {
    let i = 0;
    while (i < lines.length - 1) {
      if (this.canMergeStraightLine(lines[i], lines[i + 1])) {
        lines[i].p2.y = lines[i + 1].p2.y;
        lines.splice(i + 1, 1);
      } else {
        i++;
      }
    }
  }
  private canMergeStraightLine(first: PlacedLine, second: PlacedLine) {
    return (
      first.p1.x === first.p2.x &&
      first.p2.x === second.p1.x &&
      second.p1.x === second.p2.x &&
      first.p2.y === second.p1.y &&
      first.isCommitted === second.isCommitted
    );
  }
  private startPathIfNeeded(path: string, line: PlacedLine, previousLine: PlacedLine | undefined) {
    if (path !== "" && line.p1.x === previousLine?.p2.x && line.p1.y === previousLine.p2.y) {
      return path;
    }
    return `${path}M${line.p1.x.toFixed(0)},${line.p1.y.toFixed(1)}`;
  }
  private appendLineToPath(path: string, line: PlacedLine, d: number, graphStyle: string) {
    const x1 = line.p1.x;
    const y1 = line.p1.y;
    const x2 = line.p2.x;
    const y2 = line.p2.y;

    if (x1 === x2) {
      return `${path}L${x2.toFixed(0)},${y2.toFixed(1)}`;
    }
    if (graphStyle === "angular") {
      const transition = line.lockedFirst
        ? `${x2.toFixed(0)},${(y2 - d).toFixed(1)}`
        : `${x1.toFixed(0)},${(y1 + d).toFixed(1)}`;
      return `${path}L${transition}L${x2.toFixed(0)},${y2.toFixed(1)}`;
    }
    return `${path}C${x1.toFixed(0)},${(y1 + d).toFixed(1)} ${x2.toFixed(0)},${(y2 - d).toFixed(
      1
    )} ${x2.toFixed(0)},${y2.toFixed(1)}`;
  }
  private drawPath(svg: SVGElement, path: string, color: string) {
    const line1 = document.createElementNS("http://www.w3.org/2000/svg", "path");
    const line2 = document.createElementNS("http://www.w3.org/2000/svg", "path");
    line1.setAttribute("class", "shaddow");
    line1.setAttribute("d", path);
    line2.setAttribute("class", "line");
    line2.setAttribute("d", path);
    line2.setAttribute("stroke", color);
    svg.appendChild(line1);
    svg.appendChild(line2);
  }
}

class Vertex {
  private x: number = 0;
  private readonly y: number;
  private readonly parents: Vertex[] = [];
  private nextParent: number = 0;
  private onBranch: Branch | null = null;
  private isCommitted: boolean = true;
  private isCurrent: boolean = false;
  private nextX: number = 0;
  private connections: UnavailablePoint[] = [];

  constructor(y: number) {
    this.y = y;
  }

  public addParent(vertex: Vertex) {
    this.parents.push(vertex);
  }
  public hasParents() {
    return this.parents.length > 0;
  }
  public getNextParent(): Vertex | null {
    if (this.nextParent < this.parents.length) return this.parents[this.nextParent];
    return null;
  }
  public getLastParent(): Vertex | null {
    if (this.nextParent < 1) return null;
    return this.parents[this.nextParent - 1];
  }
  public registerParentProcessed() {
    this.nextParent++;
  }
  public isMerge() {
    return this.parents.length > 1;
  }

  public addToBranch(branch: Branch, x: number) {
    if (this.onBranch === null) {
      this.onBranch = branch;
      this.x = x;
    }
  }
  public isNotOnBranch() {
    return this.onBranch === null;
  }
  public isOnThisBranch(branch: Branch) {
    return this.onBranch === branch;
  }
  public getBranch() {
    return this.onBranch;
  }

  public getPoint(): Point {
    return { x: this.x, y: this.y };
  }
  public getNextPoint(): Point {
    return { x: this.nextX, y: this.y };
  }
  public getIsCommitted() {
    return this.isCommitted;
  }

  public getPointConnectingTo(vertex: VertexOrNull, onBranch: Branch) {
    for (let i = 0; i < this.connections.length; i++) {
      if (this.connections[i].connectsTo === vertex && this.connections[i].onBranch === onBranch)
        return { x: i, y: this.y };
    }
    return null;
  }
  public registerUnavailablePoint(x: number, connectsToVertex: VertexOrNull, onBranch: Branch) {
    if (x === this.nextX) {
      this.nextX = x + 1;
      this.connections[x] = { connectsTo: connectsToVertex, onBranch: onBranch };
    }
  }

  public getColor() {
    return this.onBranch !== null ? this.onBranch.getColor() : 0;
  }
  public setNotCommited() {
    this.isCommitted = false;
  }
  public setCurrent() {
    this.isCurrent = true;
  }
  public draw(svg: SVGElement, config: Config, expandOffset: boolean) {
    if (this.onBranch === null) return;

    const color = this.isCommitted
      ? config.graphColors[this.onBranch.getColor() % config.graphColors.length]
      : MUTED_GRAPH_COLOR;
    const cx = this.x * config.grid.x + config.grid.offsetX;
    const cy =
      this.y * config.grid.y + config.grid.offsetY + (expandOffset ? config.grid.expandY : 0);

    const isRoot = this.parents.length === 0;
    const node = document.createElementNS("http://www.w3.org/2000/svg", isRoot ? "rect" : "circle");
    if (isRoot) {
      node.setAttribute("x", (cx - NODE_RADIUS).toString());
      node.setAttribute("y", (cy - NODE_RADIUS).toString());
      node.setAttribute("width", (NODE_RADIUS * 2).toString());
      node.setAttribute("height", (NODE_RADIUS * 2).toString());
    } else {
      node.setAttribute("cx", cx.toString());
      node.setAttribute("cy", cy.toString());
      node.setAttribute("r", NODE_RADIUS.toString());
    }
    if (this.isCurrent) {
      node.setAttribute("class", "current");
      node.setAttribute("stroke", color);
    } else {
      node.setAttribute("fill", color);
    }

    svg.appendChild(node);
  }
}

export class Graph {
  private readonly config: Config;

  private readonly svg: SVGElement;
  private svgGroup: SVGGElement | null = null;
  private readonly svgMaskRect: SVGRectElement;
  private readonly svgGradientStop1: SVGStopElement;
  private readonly svgGradientStop2: SVGStopElement;
  private maxWidth: number = -1;

  private vertices: Vertex[] = [];
  private branches: Branch[] = [];
  private availableColors: number[] = [];

  constructor(id: string, config: Config) {
    this.config = config;

    const svgNamespace = "http://www.w3.org/2000/svg";
    const defs = document.createElementNS(svgNamespace, "defs");
    const linearGradient = document.createElementNS(svgNamespace, "linearGradient");
    const mask = document.createElementNS(svgNamespace, "mask");
    this.svg = <SVGElement>document.createElementNS(svgNamespace, "svg");
    this.svgMaskRect = <SVGRectElement>document.createElementNS(svgNamespace, "rect");
    this.svgGradientStop1 = <SVGStopElement>document.createElementNS(svgNamespace, "stop");
    this.svgGradientStop2 = <SVGStopElement>document.createElementNS(svgNamespace, "stop");

    linearGradient.setAttribute("id", "GraphGradient");
    this.svgGradientStop1.setAttribute("stop-color", MASK_VISIBLE_COLOR);
    linearGradient.appendChild(this.svgGradientStop1);
    this.svgGradientStop2.setAttribute("stop-color", MASK_HIDDEN_COLOR);
    linearGradient.appendChild(this.svgGradientStop2);
    defs.appendChild(linearGradient);
    mask.setAttribute("id", "GraphMask");
    this.svgMaskRect.setAttribute("fill", "url(#GraphGradient)");
    mask.appendChild(this.svgMaskRect);
    defs.appendChild(mask);
    this.svg.appendChild(defs);
    this.setDimensions(0, 0);
    const container = document.getElementById(id);
    if (container === null) {
      throw new Error(`Missing graph container: ${id}`);
    }
    container.appendChild(this.svg);
  }

  public loadCommits(
    commits: GitCommitNode[],
    commitHead: string | null,
    commitLookup: { [hash: string]: number }
  ) {
    this.vertices = [];
    this.branches = [];
    this.availableColors = [];

    for (let i = 0; i < commits.length; i++) {
      this.vertices.push(new Vertex(i));
    }
    for (const [i, commit] of commits.entries()) {
      for (const parentHash of commit.parentHashes) {
        if (typeof commitLookup[parentHash] === "number") {
          this.vertices[i].addParent(this.vertices[commitLookup[parentHash]]);
        }
      }
    }

    if (commits.length > 0) {
      if (commits[0].hash === "*") {
        this.vertices[0].setCurrent();
        this.vertices[0].setNotCommited();
      } else if (commitHead !== null && typeof commitLookup[commitHead] === "number") {
        this.vertices[commitLookup[commitHead]].setCurrent();
      }
    }

    let start = this.findStart();
    while (start !== -1) {
      this.determinePath(start);
      start = this.findStart();
    }
  }

  public render(expandedCommit: ExpandedCommit | null) {
    const group = <SVGGElement>document.createElementNS("http://www.w3.org/2000/svg", "g");
    const width = this.getWidth();
    group.setAttribute("mask", "url(#GraphMask)");

    for (const branch of this.branches) {
      branch.draw(group, this.config, expandedCommit !== null ? expandedCommit.id : -1);
    }
    for (const [i, vertex] of this.vertices.entries()) {
      vertex.draw(group, this.config, expandedCommit !== null && i > expandedCommit.id);
    }

    if (this.svgGroup !== null) this.svgGroup.remove();
    this.svg.appendChild(group);
    this.svgGroup = group;
    this.setDimensions(width, this.getHeight(expandedCommit));
    this.applyMaxWidth(width);
  }

  public clear() {
    if (this.svgGroup !== null) {
      this.svgGroup.remove();
      this.svgGroup = null;
      this.setDimensions(0, 0);
    }
  }

  public getWidth() {
    let x = 0;
    for (const vertex of this.vertices) {
      const p = vertex.getNextPoint();
      if (p.x > x) x = p.x;
    }
    return x * this.config.grid.x;
  }

  public getHeight(expandedCommit: ExpandedCommit | null) {
    return (
      this.vertices.length * this.config.grid.y +
      this.config.grid.offsetY -
      this.config.grid.y / 2 +
      (expandedCommit !== null ? this.config.grid.expandY : 0)
    );
  }

  public getVertexColor(v: number) {
    return this.vertices[v].getColor() % this.config.graphColors.length;
  }

  public limitMaxWidth(maxWidth: number) {
    this.maxWidth = maxWidth;
    this.applyMaxWidth(this.getWidth());
  }

  private setDimensions(width: number, height: number) {
    this.svg.setAttribute("width", width.toString());
    this.svg.setAttribute("height", height.toString());
    this.svgMaskRect.setAttribute("width", width.toString());
    this.svgMaskRect.setAttribute("height", height.toString());
  }

  private applyMaxWidth(width: number) {
    const offset1 = this.maxWidth > -1 ? (this.maxWidth - 12) / width : 1;
    const offset2 = this.maxWidth > -1 ? this.maxWidth / width : 1;
    this.svgGradientStop1.setAttribute("offset", offset1.toString());
    this.svgGradientStop2.setAttribute("offset", offset2.toString());
  }

  private determinePath(startAt: number) {
    const vertex = this.vertices[startAt];
    const parentVertex = vertex.getNextParent();
    if (this.isMergeBetweenExistingBranches(vertex, parentVertex)) {
      this.determineMergePath(startAt, vertex, parentVertex);
      return;
    }

    this.determineNormalPath(startAt, vertex, parentVertex);
  }

  private isMergeBetweenExistingBranches(
    vertex: Vertex,
    parentVertex: Vertex | null
  ): parentVertex is Vertex {
    return (
      parentVertex !== null &&
      vertex.isMerge() &&
      !vertex.isNotOnBranch() &&
      !parentVertex.isNotOnBranch()
    );
  }

  private determineMergePath(startAt: number, vertex: Vertex, parentVertex: Vertex) {
    const parentBranch = parentVertex.getBranch();
    if (parentBranch === null) {
      throw new Error("Expected merge parent to be on a branch");
    }

    let lastPoint = vertex.isNotOnBranch() ? vertex.getNextPoint() : vertex.getPoint();
    let foundPointToParent = false;
    for (let i = startAt + 1; i < this.vertices.length; i++) {
      const curVertex = this.vertices[i];
      const pointToParent = curVertex.getPointConnectingTo(parentVertex, parentBranch);
      const curPoint = pointToParent ?? curVertex.getNextPoint();
      foundPointToParent = foundPointToParent || pointToParent !== null;
      parentBranch.addLine(
        lastPoint,
        curPoint,
        vertex.getIsCommitted(),
        this.shouldLockMergeLine(foundPointToParent, curVertex, parentVertex, lastPoint, curPoint)
      );
      curVertex.registerUnavailablePoint(curPoint.x, parentVertex, parentBranch);
      lastPoint = curPoint;

      if (foundPointToParent) {
        vertex.registerParentProcessed();
        break;
      }
    }
  }

  private shouldLockMergeLine(
    foundPointToParent: boolean,
    curVertex: Vertex,
    parentVertex: Vertex,
    lastPoint: Point,
    curPoint: Point
  ) {
    return !foundPointToParent && curVertex !== parentVertex ? lastPoint.x < curPoint.x : true;
  }

  private determineNormalPath(
    startAt: number,
    startVertex: Vertex,
    initialParentVertex: Vertex | null
  ) {
    let vertex = startVertex;
    let parentVertex = initialParentVertex;
    let lastPoint = vertex.isNotOnBranch() ? vertex.getNextPoint() : vertex.getPoint();
    const branch = new Branch(this.getAvailableColor(startAt));
    vertex.addToBranch(branch, lastPoint.x);
    vertex.registerUnavailablePoint(lastPoint.x, vertex, branch);

    let i = startAt + 1;
    for (; i < this.vertices.length; i++) {
      const curVertex = this.vertices[i];
      const curPoint = this.getNormalPathPoint(parentVertex, curVertex);
      branch.addLine(lastPoint, curPoint, vertex.getIsCommitted(), lastPoint.x < curPoint.x);
      curVertex.registerUnavailablePoint(curPoint.x, parentVertex, branch);
      lastPoint = curPoint;

      if (parentVertex === curVertex) {
        vertex.registerParentProcessed();
        const parentVertexOnBranch = !parentVertex.isNotOnBranch();
        parentVertex.addToBranch(branch, curPoint.x);
        vertex = parentVertex;
        parentVertex = vertex.getNextParent();
        if (parentVertexOnBranch || parentVertex === null) break;
      }
    }

    branch.setEnd(i);
    this.branches.push(branch);
    this.availableColors[branch.getColor()] = i;
  }

  private getNormalPathPoint(parentVertex: Vertex | null, curVertex: Vertex) {
    if (parentVertex === curVertex && !parentVertex.isNotOnBranch()) {
      return curVertex.getPoint();
    }
    return curVertex.getNextPoint();
  }

  private findStart() {
    for (let i = 0; i < this.vertices.length; i++) {
      if (this.vertices[i].getNextParent() !== null || this.vertices[i].isNotOnBranch()) return i;
    }
    return -1;
  }

  private getAvailableColor(startAt: number) {
    for (let i = 0; i < this.availableColors.length; i++) {
      if (startAt > this.availableColors[i]) {
        return i;
      }
    }
    this.availableColors.push(0);
    return this.availableColors.length - 1;
  }
}
