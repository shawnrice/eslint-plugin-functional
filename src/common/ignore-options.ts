// Polyfill.
import "array.prototype.flatmap/auto.js";

import { TSESTree } from "@typescript-eslint/typescript-estree";
import escapeRegExp from "escape-string-regexp";
import { JSONSchema4 } from "json-schema";

import { BaseOptions, RuleContext } from "../util/rule";
import { inClass, inFunction, inInterface } from "../util/tree";
import {
  isAssignmentExpression,
  isCallExpression,
  isIdentifier,
  isMemberExpression,
  isTSPropertySignature,
  isTypeAliasDeclaration,
  isVariableDeclaration,
  isVariableDeclarator
} from "../util/typeguard";

export type AllIgnoreOptions = IgnoreLocalOption &
  IgnorePatternOption &
  IgnoreAccessorPatternOption &
  IgnoreClassOption &
  IgnoreInterfaceOption &
  IgnoreNewArrayOption;

export type IgnoreLocalOption = {
  readonly ignoreLocal?: boolean;
};

export const ignoreLocalOptionSchema: JSONSchema4 = {
  type: "object",
  properties: {
    ignoreLocal: {
      type: "boolean"
    }
  },
  additionalProperties: false
};

export interface IgnorePatternOption {
  readonly ignorePattern?: string | Array<string>;
}

export const ignorePatternOptionSchema: JSONSchema4 = {
  type: "object",
  properties: {
    ignorePattern: {
      type: ["string", "array"],
      items: {
        type: "string"
      }
    }
  },
  additionalProperties: false
};

export interface IgnoreAccessorPatternOption {
  readonly ignoreAccessorPattern?: string | Array<string>;
}

export const ignoreAccessorPatternOptionSchema: JSONSchema4 = {
  type: "object",
  properties: {
    ignoreAccessorPattern: {
      type: ["string", "array"],
      items: {
        type: "string"
      }
    }
  },
  additionalProperties: false
};

export interface IgnoreReturnTypeOption {
  readonly ignoreReturnType?: boolean;
}
export const ignoreReturnTypeOptionSchema: JSONSchema4 = {
  type: "object",
  properties: {
    ignoreReturnType: {
      type: "boolean"
    }
  },
  additionalProperties: false
};

export interface IgnoreClassOption {
  readonly ignoreClass?: boolean;
}
export const ignoreClassOptionSchema: JSONSchema4 = {
  type: "object",
  properties: {
    ignoreClass: {
      type: "boolean"
    }
  },
  additionalProperties: false
};

export interface IgnoreInterfaceOption {
  readonly ignoreInterface?: boolean;
}
export const ignoreInterfaceOptionSchema: JSONSchema4 = {
  type: "object",
  properties: {
    ignoreInterface: {
      type: "boolean"
    }
  },
  additionalProperties: false
};

export interface IgnoreNewArrayOption {
  readonly ignoreNewArray?: boolean;
}
export const ignoreNewArrayOptionSchema: JSONSchema4 = {
  type: "object",
  properties: {
    ignoreNewArray: {
      type: "boolean"
    }
  },
  additionalProperties: false
};

/**
 * Should the given node be ignored?
 */
export function shouldIgnore(
  node: TSESTree.Node,
  context: RuleContext<string, BaseOptions>,
  ignoreOptions: AllIgnoreOptions
): boolean {
  // Ignore if in a function and ignoreLocal is set.
  if (ignoreOptions.ignoreLocal && inFunction(node)) {
    return true;
  }

  // Ignore if in a class and ignoreClass is set.
  if (ignoreOptions.ignoreClass && inClass(node)) {
    return true;
  }

  // Ignore if in an interface and ignoreInterface is set.
  if (ignoreOptions.ignoreInterface && inInterface(node)) {
    return true;
  }

  // Is ignorePattern set?
  if (ignoreOptions.ignorePattern !== undefined) {
    const texts: ReadonlyArray<string> = getNodeTexts(node, context);
    if (
      texts.length > 0 &&
      // Ignore if a pattern matches for every text item.
      texts.every(text => isIgnoredPattern(text, ignoreOptions.ignorePattern!))
    ) {
      return true;
    }
  }

  // Is ignoreAccessorPattern set?
  if (ignoreOptions.ignoreAccessorPattern !== undefined) {
    const accessor = getAccessorName(node);
    // Ignore if a pattern matches.
    if (
      accessor &&
      isIgnoredAccessorPattern(accessor, ignoreOptions.ignoreAccessorPattern!)
    ) {
      return true;
    }
  }

  return false;
}

function getNodeTexts(
  node: TSESTree.Node,
  context: RuleContext<string, BaseOptions>
): ReadonlyArray<string> {
  return (isVariableDeclaration(node)
    ? node.declarations.flatMap(declarator => getNodeTexts(declarator, context))
    : isVariableDeclarator(node) || isTypeAliasDeclaration(node)
    ? getNodeTexts(node.id, context)
    : isTSPropertySignature(node)
    ? getNodeTexts(node.key, context)
    : [context.getSourceCode().getText(node)]
  ).filter(name => name !== undefined) as ReadonlyArray<string>;
}

function getAccessorName(node: TSESTree.Node): string | undefined {
  return isAssignmentExpression(node)
    ? getAccessorName(node.left)
    : isCallExpression(node)
    ? getAccessorName(node.callee)
    : isMemberExpression(node)
    ? getAccessorBaseName(node.object)
    : getAccessorBaseName(node);
}

function getAccessorBaseName(
  node: TSESTree.Identifier | TSESTree.MemberExpression
): string;
function getAccessorBaseName(
  node: Exclude<TSESTree.Node, TSESTree.Identifier & TSESTree.MemberExpression>
): undefined;
function getAccessorBaseName(node: TSESTree.Node): string | undefined {
  return isIdentifier(node)
    ? node.name
    : isMemberExpression(node)
    ? `${getAccessorBaseName(node.object)}.${getAccessorBaseName(
        node.property
      )}`
    : undefined;
}

function isIgnoredPattern(
  text: string,
  ignorePattern: Array<string> | string
): boolean {
  const patterns = Array.isArray(ignorePattern)
    ? ignorePattern
    : [ignorePattern];

  // One or more patterns match?
  return patterns.some(pattern => new RegExp(pattern).test(text));
}

function isIgnoredAccessorPattern(
  text: string,
  ignorePattern: Array<string> | string
): boolean {
  const patterns = Array.isArray(ignorePattern)
    ? ignorePattern
    : [ignorePattern];

  // One or more patterns match?
  return patterns.some(pattern =>
    findMatch(pattern.split("."), text.split("."))
  );
}

function findMatch(
  patternParts: ReadonlyArray<string>,
  textParts: ReadonlyArray<string>
): boolean {
  const maxlength =
    patternParts.length > textParts.length
      ? patternParts.length
      : textParts.length;

  for (let index = 0; index < maxlength; index++) {
    // Out of text or pattern?
    if (
      index >= patternParts.length ||
      (patternParts[index] !== "**" && index >= textParts.length)
    ) {
      return false;
    }

    switch (patternParts[index]) {
      // Match any depth (including 0)?
      case "**": {
        const subpattern = patternParts.slice(index + 1);
        if (subpattern.length === 0) {
          return true;
        }
        for (let offset = 0; offset < textParts.length - index; offset++) {
          const submatch = findMatch(
            subpattern,
            textParts.slice(index + offset)
          );
          if (submatch) {
            return submatch;
          }
        }
        return false;
      }

      // Match anything?
      case "*":
        continue;

      default:
        break;
    }

    // textParts[i] matches patternParts[i]?
    if (
      new RegExp(
        "^" + escapeRegExp(patternParts[index]).replace(/\\\*/g, ".*") + "$"
      ).test(textParts[index])
    ) {
      continue;
    }

    // No Match.
    return false;
  }

  // Match.
  return true;
}
