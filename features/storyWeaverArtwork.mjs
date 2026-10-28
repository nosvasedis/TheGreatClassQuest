// Direct scene prompts avoid a separate text-generation round trip for every page.
export function buildStoryIllustrationPrompt(sentence, recentHistory = '') {
    const scene = String(sentence || '').replace(/\s+/g, ' ').trim().slice(0, 800);
    const context = String(recentHistory || '').replace(/\s+/g, ' ').trim().slice(-400);
    return `Beautiful whimsical children's storybook watercolor, friendly expressive characters, simple shapes, warm light, cheerful colors, clear composition. Illustrate this scene: ${scene}.`
        + (context ? ` Keep characters consistent with this earlier scene: ${context}.` : '')
        + ' One coherent scene, no text, letters, captions or watermark.';
}

// A late image belongs to its saved page. Never replace the current illustration
// after another page was written, the book was reset, or the page was deleted.
export async function attachStoryIllustration({ db, runTransaction, storyRef, pageRef, sentence, imageUrl, updatedAt }) {
    return runTransaction(db, async (tx) => {
        const story = await tx.get(storyRef);
        const page = pageRef ? await tx.get(pageRef) : null;
        if (!story.exists() || (pageRef && (!page.exists() || page.data().sentence !== sentence))) return false;
        const current = story.data();
        const isCurrent = current.currentSentence === sentence
            && (current.currentPageId ? current.currentPageId === pageRef?.id : true);
        if (!pageRef && !isCurrent) return false;
        if (pageRef) tx.update(pageRef, { imageUrl });
        if (isCurrent) tx.update(storyRef, { currentImageUrl: imageUrl, updatedAt });
        return true;
    });
}
