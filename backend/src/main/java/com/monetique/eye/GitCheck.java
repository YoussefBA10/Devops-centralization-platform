import java.io.File;
import java.io.IOException;

public class GitCheck {
    public static void main(String[] args) {
        String gitExecutable = "git";
        String resolved = resolveGitExecutable(gitExecutable);
        System.out.println("Resolved Git: " + resolved);
        System.out.println("Can run: " + canRun(resolved));
    }

    private static String resolveGitExecutable(String gitExecutable) {
        if (canRun(gitExecutable)) return gitExecutable;
        if (!gitExecutable.equals("git") && canRun("git")) return "git";
        String os = System.getProperty("os.name").toLowerCase();
        if (os.contains("win")) {
            String[] commonPaths = {
                "C:\\Program Files\\Git\\bin\\git.exe",
                "C:\\Program Files (x86)\\Git\\bin\\git.exe",
                System.getProperty("user.home") + "\\AppData\\Local\\Programs\\Git\\bin\\git.exe"
            };
            for (String path : commonPaths) {
                File f = new File(path);
                System.out.println("Checking path: " + path + " - Exists: " + f.exists());
                if (f.exists()) return path;
            }
        }
        return gitExecutable;
    }

    private static boolean canRun(String cmd) {
        try {
            new ProcessBuilder(cmd, "--version").start().waitFor();
            return true;
        } catch (Exception e) {
            return false;
        }
    }
}
