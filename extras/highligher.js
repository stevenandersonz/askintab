// --- Text Selection & Highlighting Logic ---
class TextHighlighter {
    /**
     * Gets the DOM path of a node relative to the BODY element.
     * @param {Node} node - The node to get the path for.
     * @returns {number[]} An array of child indices representing the path.
     */
    static getElementPath(node) {
      const path = [];
      let current = node;
      while (current && current.tagName !== "BODY") {
        const parent = current.parentElement;
        if (!parent) break; // Should not happen in a valid document
        // Filter out non-element nodes before getting index
        const elementChildren = Array.from(parent.childNodes).filter(n => n.nodeType === Node.ELEMENT_NODE || n.nodeType === Node.TEXT_NODE);
        const index = elementChildren.indexOf(current);
        if (index === -1) break; // Node not found among element/text children
        path.unshift(index);
        current = parent;
      }
      return path;
    }

    /**
     * Finds a node in the document based on its DOM path.
     * @param {number[]} path - The array of child indices.
     * @returns {Node|null} The found node or null if not found.
     */
    static findNodeByPath(path) {
      let current = document.body;
      try {
        for (const index of path) {
          // Filter out non-element nodes when traversing
          const elementChildren = Array.from(current.childNodes).filter(n => n.nodeType === Node.ELEMENT_NODE || n.nodeType === Node.TEXT_NODE);
          if (index < 0 || index >= elementChildren.length) {
            console.warn('Node index out of bounds during path traversal:', index, elementChildren);
            return null; // Path is invalid
          }
          current = elementChildren[index];
          if (!current) return null; // Node not found at index
        }
        return current;
      } catch (error) {
        console.error('Error finding node by path:', error, path);
        return null;
      }
    }

    /**
     * Serializes a DOM Range object into a plain object with paths.
     * @param {Range} range - The DOM Range object.
     * @returns {object|null} A serializable representation of the range, or null if invalid.
     */
    static serializeRange(range) {
      if (!range || !range.startContainer || !range.endContainer) return null;
      return {
        startContainerPath: this.getElementPath(range.startContainer),
        startOffset: range.startOffset,
        endContainerPath: this.getElementPath(range.endContainer),
        endOffset: range.endOffset
      };
    }

    /**
     * Highlights text in the document based on serialized range data.
     * @param {object} rangeData - The serialized range object.
     */
    static highlightTextInDocument(rangeData) {
      if (!rangeData || !rangeData.startContainerPath || !rangeData.endContainerPath) {
        console.warn('Invalid range data provided for highlighting.');
        return;
      }

      const { startContainerPath, startOffset, endContainerPath, endOffset } = rangeData;
      try {
        const startNode = this.findNodeByPath(startContainerPath);
        const endNode = this.findNodeByPath(endContainerPath);

        if (!startNode || !endNode) {
          console.error('Could not find nodes for highlighting using paths:', startContainerPath, endContainerPath);
          return;
        }

        const range = document.createRange();
        // Ensure offsets are within the valid bounds of the nodes
        const safeStartOffset = Math.min(startOffset, startNode.textContent?.length ?? 0);
        const safeEndOffset = Math.min(endOffset, endNode.textContent?.length ?? 0);

        range.setStart(startNode, safeStartOffset);
        range.setEnd(endNode, safeEndOffset);

        const selection = window.getSelection();
        if (!selection) return;
        selection.removeAllRanges();
        selection.addRange(range);

        // Scroll into view if needed
        const rect = range.getBoundingClientRect();
        if (rect.top < 0 || rect.bottom > window.innerHeight) {
          const targetScrollY = window.scrollY + rect.top - 100; // Adjust scroll position
          window.scrollTo({
            top: targetScrollY,
            behavior: 'smooth'
          });
        }
      } catch (error) {
        console.error('Failed to highlight text:', error, rangeData);
      }
    }
  }