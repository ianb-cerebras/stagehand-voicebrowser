# Voice Browser

Voice-based accessibiliy tool using Stagehand to agentically navigate the internet. Average stagehand request is 10K tokens, so this is only possible within a reasonable timeframe with Cerebras. Big challenges still to come: 

## Primary System

The core of this will effectively be a recursive call that takes in user inputs and executes the "act" function that Stagehand provides natively. Currently building this out first and testing it with text-input commands to make sure this can run at the speed and generally function how I hope it will (which it does!).

## Voice Interaction

The actual voice component of the interaction. Will start this when the primary system is up and running, hut this will be a lot easier to figure out because it is 

## Interface?

A way to access this or deploy it somehow. This one is TBD. 