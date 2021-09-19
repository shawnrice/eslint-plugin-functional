import { TSESTree } from "@typescript-eslint/experimental-utils";
import { all as deepMerge } from "deepmerge";
import { JSONSchema4 } from "json-schema";

import {
  AllowLocalMutationOption,
  allowLocalMutationOptionSchema,
  IgnorePatternOption,
  ignorePatternOptionSchema,
} from "../common/ignore-options";
import {
  createRule,
  RuleContext,
  RuleMetaData,
  RuleResult,
} from "../util/rule";
import { inForLoopInitializer } from "../util/tree";

// The name of this rule.
export const name = "no-let" as const;

// The options this rule can take.
type Options = AllowLocalMutationOption &
  IgnorePatternOption & {
    readonly allowInForLoopInit: boolean;
  };

// The schema for the rule options.
const schema: JSONSchema4 = [
  deepMerge([
    allowLocalMutationOptionSchema,
    ignorePatternOptionSchema,
    {
      type: "object",
      properties: {
        allowInForLoopInit: {
          type: "boolean",
        },
      },
      additionalProperties: false,
    },
  ]),
];

// The default options for the rule.
const defaultOptions: Options = {
  allowInForLoopInit: false,
  allowLocalMutation: false,
};

// The possible error messages.
const errorMessages = {
  generic: "Unexpected let, use const instead.",
} as const;

// The meta data for this rule.
const meta: RuleMetaData<keyof typeof errorMessages> = {
  type: "suggestion",
  docs: {
    description: "Disallow mutable variables.",
    category: "Best Practices",
    recommended: "error",
  },
  messages: errorMessages,
  fixable: "code",
  schema,
};

/**
 * Check if the given VariableDeclaration violates this rule.
 */
function checkVariableDeclaration(
  node: TSESTree.VariableDeclaration,
  context: RuleContext<keyof typeof errorMessages, Options>,
  options: Options
): RuleResult<keyof typeof errorMessages, Options> {
  if (
    node.kind !== "let" ||
    (options.allowInForLoopInit && inForLoopInitializer(node))
  ) {
    return {
      context,
      descriptors: [],
    };
  }

  return {
    context,
    descriptors: [{ node, messageId: "generic" }],
  };
}

// Create the rule.
export const rule = createRule<keyof typeof errorMessages, Options>(
  name,
  meta,
  defaultOptions,
  {
    VariableDeclaration: checkVariableDeclaration,
  }
);
