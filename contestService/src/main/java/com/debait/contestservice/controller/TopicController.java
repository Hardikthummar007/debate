package com.debait.contestservice.controller;

import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.Arrays;
import java.util.List;

@RestController
@RequestMapping("/api/topics")
public class TopicController {

    public static class TopicDto {
        private String id;
        private String title;
        private String description;

        public TopicDto(String id, String title, String description) {
            this.id = id;
            this.title = title;
            this.description = description;
        }

        // Getters and Setters
        public String getId() {
            return id;
        }

        public void setId(String id) {
            this.id = id;
        }

        public String getTitle() {
            return title;
        }

        public void setTitle(String title) {
            this.title = title;
        }

        public String getDescription() {
            return description;
        }

        public void setDescription(String description) {
            this.description = description;
        }
    }

    @GetMapping
    public ResponseEntity<List<TopicDto>> getTopics() {
        List<TopicDto> topics = Arrays.asList(
            new TopicDto(
                "ai-replace-devs", 
                "AI will replace software developers", 
                "Will Large Language Models and AI coding systems render human software engineering obsolete?"
            ),
            new TopicDto(
                "social-media", 
                "Social media is beneficial", 
                "Has social media improved human connection and society, or has it caused widespread polarization?"
            ),
            new TopicDto(
                "remote-work", 
                "Remote work is better than office work", 
                "Is fully remote work superior to office-based work in terms of productivity and quality of life?"
            )
        );
        return ResponseEntity.ok(topics);
    }
}
