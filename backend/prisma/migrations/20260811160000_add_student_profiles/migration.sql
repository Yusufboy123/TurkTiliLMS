-- CreateEnum
CREATE TYPE "student_onboarding_level" AS ENUM ('UNKNOWN', 'A1', 'A2', 'B1', 'B2', 'C1', 'C2');

-- CreateEnum
CREATE TYPE "student_learning_goal" AS ENUM ('WORK', 'STUDY', 'EXAM', 'TRAVEL', 'DAILY_COMMUNICATION', 'PERSONAL_DEVELOPMENT', 'OTHER');

-- CreateEnum
CREATE TYPE "student_age_range" AS ENUM ('AGE_13_17', 'AGE_18_24', 'AGE_25_34', 'AGE_35_44', 'AGE_45_PLUS');

-- CreateEnum
CREATE TYPE "student_gender" AS ENUM ('MALE', 'FEMALE', 'PREFER_NOT_TO_SAY');

-- CreateEnum
CREATE TYPE "student_weekly_study_band" AS ENUM ('HOURS_1_2', 'HOURS_3_5', 'HOURS_5_PLUS');

-- CreateEnum
CREATE TYPE "student_skill_focus" AS ENUM ('SPEAKING', 'LISTENING', 'READING', 'WRITING', 'ALL');

-- CreateTable
CREATE TABLE "student_profiles" (
    "user_id" UUID NOT NULL,
    "current_level" "student_onboarding_level" NOT NULL,
    "learning_goal" "student_learning_goal" NOT NULL,
    "age_range" "student_age_range",
    "gender" "student_gender",
    "weekly_study_band" "student_weekly_study_band",
    "preferred_skill_focus" "student_skill_focus",
    "onboarding_completed_at" TIMESTAMPTZ(3),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "student_profiles_pkey" PRIMARY KEY ("user_id")
);

-- AddForeignKey
ALTER TABLE "student_profiles" ADD CONSTRAINT "student_profiles_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
