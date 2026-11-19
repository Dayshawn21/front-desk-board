# Prompt fix on Haiku: clock times and last-name matching

Same model as v1 (claude-haiku-5-5). Two rules added to the system prompt in server/parseBooking.ts, from v1 misses: a clock time with or without "at" ("at 10:15") becomes earliest and wins over morning/afternoon (riverbend-full failed both reps); a patient can be matched by last name with a title ("Ms. Silva") when exactly one matches (last-name-only failed once).
